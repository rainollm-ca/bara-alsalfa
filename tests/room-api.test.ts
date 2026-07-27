import { beforeEach, describe, expect, it } from "vitest";

import { POST as createRoom } from "../src/app/api/rooms/route";
import { POST as joinRoom } from "../src/app/api/rooms/[code]/join/route";
import { GET as getRoomState } from "../src/app/api/rooms/[code]/state/route";
import { POST as roomAction } from "../src/app/api/rooms/[code]/action/route";
import { clientIdentity, resetRoomRepositoryForTests } from "../src/rooms/server";
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

  it("returns ROOM_IN_PROGRESS for a late join but permits token reconnect", async () => {
    const created = await (await createRoom(jsonRequest("http://localhost/api/rooms", {
      contractVersion: 1, hostName: "Host", gameId: "category-challenge",
    }))).json();
    const guest = await (await joinRoom(jsonRequest(`http://localhost/api/rooms/${created.code}/join`, {
      contractVersion: 1, name: "Guest",
    }), context(created.code))).json();
    await roomAction(jsonRequest(`http://localhost/api/rooms/${created.code}/action`, {
      contractVersion: 1, action: { type: "lobby/start" },
    }, created.hostToken), context(created.code));

    const late = await joinRoom(jsonRequest(`http://localhost/api/rooms/${created.code}/join`, {
      contractVersion: 1, name: "Late",
    }), context(created.code));
    expect(late.status).toBe(409);
    expect((await late.json()).error.code).toBe("ROOM_IN_PROGRESS");
    const reconnect = await joinRoom(jsonRequest(`http://localhost/api/rooms/${created.code}/join`, {
      contractVersion: 1, name: "Ignored", playerToken: guest.playerToken,
    }), context(created.code));
    expect(reconnect.status).toBe(200);
    expect((await reconnect.json()).reconnected).toBe(true);
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

  it("uses one non-spoofable default bucket despite rotating forwarded headers", async () => {
    for (let index = 0; index < 5; index += 1) {
      expect((await createRoom(new Request("http://localhost/api/rooms", {
        method: "POST",
        headers: { "content-type": "application/json", "x-forwarded-for": `203.0.113.${index}` },
        body: JSON.stringify({ contractVersion: 1, hostName: `Host ${index}` }),
      }))).status).toBe(201);
    }
    const limited = await createRoom(new Request("http://localhost/api/rooms", {
      method: "POST",
      headers: { "content-type": "application/json", "x-forwarded-for": "198.51.100.99" },
      body: JSON.stringify({ contractVersion: 1, hostName: "One too many" }),
    }));
    expect(limited.status).toBe(429);
    expect((await limited.json()).error.code).toBe("RATE_LIMITED");
  });

  it("accepts only one canonical IP when trusted proxy mode is explicit", () => {
    expect(clientIdentity(new Request("http://localhost", {
      headers: { "x-forwarded-for": "2001:DB8::1" },
    }), true)).toBe("2001:db8::1");
    expect(clientIdentity(new Request("http://localhost", {
      headers: { "x-forwarded-for": "203.0.113.9" },
    }), false)).toBe("anonymous");
    expect(() => clientIdentity(new Request("http://localhost", {
      headers: { "x-forwarded-for": "203.0.113.9, 10.0.0.2" },
    }), true)).toThrowError(expect.objectContaining({ code: "INVALID_PROXY_HEADER" }));
    expect(() => clientIdentity(new Request("http://localhost", {
      headers: { "x-forwarded-for": "not-an-ip" },
    }), true)).toThrowError(expect.objectContaining({ code: "INVALID_PROXY_HEADER" }));
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

  it("extends expiry and last-seen time on an authenticated state poll", async () => {
    let now = 2_000;
    const repository = new RoomRepository({
      clock: () => now,
      inactivityMs: 100,
      codeFactory: () => "POLL12",
    });
    resetRoomRepositoryForTests(repository);
    const created = await (
      await createRoom(jsonRequest("http://localhost/api/rooms", {
        contractVersion: 1,
        hostName: "Host",
      }))
    ).json();
    now += 80;
    const response = await getRoomState(
      new Request(`http://localhost/api/rooms/${created.code}/state`, {
        headers: { authorization: `Bearer ${created.playerToken}` },
      }),
      context(created.code),
    );
    const payload = await response.json();
    expect(response.status).toBe(200);
    expect(payload.room.self.lastSeenAt).toBe(2_080);
    expect(payload.room.expiresAt).toBe(2_180);
    now += 80;
    expect(repository.get(created.code)).toBeDefined();
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

  it("rejects wrong-game commands and forged authoritative score fields over HTTP", async () => {
    const created = await (await createRoom(jsonRequest("http://localhost/api/rooms", {
      contractVersion: 1, hostName: "Host", gameId: "charades",
    }))).json();
    for (const name of ["Guest 1", "Guest 2", "Guest 3"]) {
      await joinRoom(jsonRequest(`http://localhost/api/rooms/${created.code}/join`, {
        contractVersion: 1, name,
      }), context(created.code));
    }
    await roomAction(jsonRequest(`http://localhost/api/rooms/${created.code}/action`, {
      contractVersion: 1, action: { type: "lobby/start" },
    }, created.hostToken), context(created.code));
    const wrongGame = await roomAction(jsonRequest(`http://localhost/api/rooms/${created.code}/action`, {
      contractVersion: 1, action: { type: "rapid-fire/mark", outcome: "correct" },
    }, created.hostToken), context(created.code));
    expect(wrongGame.status).toBe(422);
    const forged = await roomAction(jsonRequest(`http://localhost/api/rooms/${created.code}/action`, {
      contractVersion: 1, action: { type: "charades/mark", outcome: "correct", score: 999, publicData: { won: true } },
    }, created.hostToken), context(created.code));
    expect(forged.status).toBe(422);
  });

  it("never leaks the Out of Loop outsider or word to the wrong player before reveal", async () => {
    const created = await (await createRoom(jsonRequest("http://localhost/api/rooms", {
      contractVersion: 1, hostName: "Host", gameId: "out-of-loop",
    }))).json();
    const guest = await (await joinRoom(jsonRequest(`http://localhost/api/rooms/${created.code}/join`, {
      contractVersion: 1, name: "Guest",
    }), context(created.code))).json();
    const outsider = await (await joinRoom(jsonRequest(`http://localhost/api/rooms/${created.code}/join`, {
      contractVersion: 1, name: "Outsider",
    }), context(created.code))).json();
    await roomAction(jsonRequest(`http://localhost/api/rooms/${created.code}/action`, {
      contractVersion: 1, action: { type: "lobby/start" },
    }, created.hostToken), context(created.code));
    const view = async (token: string) => (await getRoomState(new Request(
      `http://localhost/api/rooms/${created.code}/state`,
      { headers: { authorization: `Bearer ${token}` } },
    ), context(created.code))).json();
    const hostView = await view(created.playerToken);
    const guestView = await view(guest.playerToken);
    const outsiderView = await view(outsider.playerToken);
    const views = [hostView, guestView, outsiderView];
    const projectedOutsiders = views.filter((entry) => entry.room.gameState.privateData.role === "outsider");
    const projectedInsiders = views.filter((entry) => entry.room.gameState.privateData.role === "insider");
    expect(projectedOutsiders).toHaveLength(1);
    expect(projectedInsiders).toHaveLength(2);
    const secretWord = projectedInsiders[0].room.gameState.privateData.word.en;
    expect(JSON.stringify(projectedOutsiders[0])).not.toContain(secretWord);
    expect(JSON.stringify(hostView.room.gameState.publicData)).not.toContain("outsider");
    expect(JSON.stringify([hostView, guestView, outsiderView])).not.toContain(created.hostToken);
  });
});
