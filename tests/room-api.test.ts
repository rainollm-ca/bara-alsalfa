import { beforeEach, describe, expect, it } from "vitest";

import { POST as createRoom } from "../src/app/api/rooms/route";
import { POST as joinRoom } from "../src/app/api/rooms/[code]/join/route";
import { GET as getRoomState } from "../src/app/api/rooms/[code]/state/route";
import { POST as roomAction } from "../src/app/api/rooms/[code]/action/route";
import { resetRoomRepositoryForTests } from "../src/rooms/server";
import { RoomRepository } from "../src/rooms/repository";

const context = (code: string) => ({ params: Promise.resolve({ code }) });
const jsonRequest = (url: string, body: unknown, token?: string) =>
  new Request(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });

describe("room HTTP API", () => {
  beforeEach(() => resetRoomRepositoryForTests());

  it("creates and joins a versioned room without leaking credentials", async () => {
    const createdResponse = await createRoom(
      jsonRequest("http://localhost/api/rooms", {
        contractVersion: 1,
        hostName: "Host",
        locale: "en",
        gameId: "charades",
      }),
    );
    expect(createdResponse.status).toBe(201);
    const created = await createdResponse.json();
    expect(created).toMatchObject({
      contractVersion: 1,
      room: { contractVersion: 1, selectedGame: "charades" },
    });
    expect(created.hostToken).toEqual(expect.any(String));
    expect(created.playerToken).toEqual(expect.any(String));
    expect(JSON.stringify(created.room)).not.toContain(created.hostToken);
    expect(JSON.stringify(created.room)).not.toContain(created.playerToken);

    const joinedResponse = await joinRoom(
      jsonRequest(`http://localhost/api/rooms/${created.code}/join`, {
        contractVersion: 1,
        name: "Guest",
      }),
      context(created.code),
    );
    expect(joinedResponse.status).toBe(200);
    const joined = await joinedResponse.json();
    expect(joined.room.players.map((player: { name: string }) => player.name)).toEqual([
      "Host",
      "Guest",
    ]);
    expect(JSON.stringify(joined.room)).not.toContain(joined.playerToken);
  });

  it("maps malformed input, unsupported versions, media types, and oversized bodies", async () => {
    const malformed = await createRoom(
      new Request("http://localhost/api/rooms", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{",
      }),
    );
    expect(malformed.status).toBe(400);

    const oldVersion = await createRoom(
      jsonRequest("http://localhost/api/rooms", {
        contractVersion: 2,
        hostName: "Host",
      }),
    );
    expect(oldVersion.status).toBe(422);

    const wrongType = await createRoom(
      new Request("http://localhost/api/rooms", {
        method: "POST",
        headers: { "content-type": "text/plain" },
        body: "{}",
      }),
    );
    expect(wrongType.status).toBe(415);

    const tooLarge = await createRoom(
      jsonRequest("http://localhost/api/rooms", {
        contractVersion: 1,
        hostName: "x".repeat(70_000),
      }),
    );
    expect(tooLarge.status).toBe(413);
  });

  it("rejects invalid codes and requires a valid player bearer token for state", async () => {
    const invalid = await joinRoom(
      jsonRequest("http://localhost/api/rooms/BAD/join", {
        contractVersion: 1,
        name: "Guest",
      }),
      context("BAD"),
    );
    expect(invalid.status).toBe(404);

    const created = await (
      await createRoom(
        jsonRequest("http://localhost/api/rooms", {
          contractVersion: 1,
          hostName: "Host",
        }),
      )
    ).json();
    const unauthorized = await getRoomState(
      new Request(`http://localhost/api/rooms/${created.code}/state`),
      context(created.code),
    );
    expect(unauthorized.status).toBe(401);
    const state = await getRoomState(
      new Request(`http://localhost/api/rooms/${created.code}/state`, {
        headers: { authorization: `Bearer ${created.playerToken}` },
      }),
      context(created.code),
    );
    expect(state.status).toBe(200);
    expect(JSON.stringify(await state.json())).not.toContain("Token");
  });

  it("allows host actions with the host token and denies them to players", async () => {
    const created = await (
      await createRoom(
        jsonRequest("http://localhost/api/rooms", {
          contractVersion: 1,
          hostName: "Host",
        }),
      )
    ).json();
    const denied = await roomAction(
      jsonRequest(
        `http://localhost/api/rooms/${created.code}/action`,
        { contractVersion: 1, action: { type: "lobby/select-game", gameId: "charades" } },
        created.playerToken,
      ),
      context(created.code),
    );
    expect(denied.status).toBe(403);

    const accepted = await roomAction(
      jsonRequest(
        `http://localhost/api/rooms/${created.code}/action`,
        { contractVersion: 1, action: { type: "lobby/select-game", gameId: "charades" } },
        created.hostToken,
      ),
      context(created.code),
    );
    expect(accepted.status).toBe(200);
    expect((await accepted.json()).room.selectedGame).toBe("charades");
  });

  it("returns gone for an expired room", async () => {
    let now = 1_000;
    resetRoomRepositoryForTests(new RoomRepository({
      clock: () => now,
      inactivityMs: 100,
      codeFactory: () => "OLD123",
      tokenFactory: (() => {
        let value = 0;
        return () => `secure-expiry-token-${++value}`;
      })(),
    }));
    const created = await (
      await createRoom(jsonRequest("http://localhost/api/rooms", {
        contractVersion: 1,
        hostName: "Host",
      }))
    ).json();
    now += 101;
    const response = await joinRoom(
      jsonRequest("http://localhost/api/rooms/OLD123/join", {
        contractVersion: 1,
        name: "Guest",
      }),
      context(created.code),
    );
    expect(response.status).toBe(410);
    expect((await response.json()).error.code).toBe("ROOM_EXPIRED");
  });

  it("projects distinct private payloads only to their owner", async () => {
    const created = await (
      await createRoom(jsonRequest("http://localhost/api/rooms", {
        contractVersion: 1,
        hostName: "Host",
        privateData: { secret: "host-private-value" },
      }))
    ).json();
    const joined = await (
      await joinRoom(
        jsonRequest(`http://localhost/api/rooms/${created.code}/join`, {
          contractVersion: 1,
          name: "Guest",
          privateData: { secret: "guest-private-value" },
        }),
        context(created.code),
      )
    ).json();
    const hostPayload = JSON.stringify((await (
      await getRoomState(
        new Request(`http://localhost/api/rooms/${created.code}/state`, {
          headers: { authorization: `Bearer ${created.playerToken}` },
        }),
        context(created.code),
      )
    ).json()));
    const guestPayload = JSON.stringify(joined);
    expect(hostPayload).toContain("host-private-value");
    expect(hostPayload).not.toContain("guest-private-value");
    expect(guestPayload).toContain("guest-private-value");
    expect(guestPayload).not.toContain("host-private-value");
    expect(hostPayload + guestPayload).not.toContain(created.hostToken);
  });
});
