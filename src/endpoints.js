import {
  rooms,
  users,
  categories,
  questionSets,
  publicRoomCodes,
} from "./globals.js";
import { getCategories } from "./getRequests.js";

const apiKey = process.env.API_KEY;
var debug = true;

const checkKey = (req, res) => {
  if (req.query.key !== apiKey) {
    res.status(403).send({
      error: "Ivalid API Key",
    });
    return false;
  }
  return true;
};

export function endpoints(app) {
  app.get("/api/categories", function (req, res) {
    if (!checkKey(req, res)) return;
    res.send(categories);
  });

  app.get("/api/users", function (req, res) {
    if (!checkKey(req, res)) return;
    res.send({ count: Object.keys(users).length, users: users });
  });

  app.get("/api/users/:name", function (req, res) {
    if (!checkKey(req, res)) return;
    const name = req.params.name;
    if (name in users) {
      res.send(users[name]);
      return;
    }
    res.status(404).send({ error: "User not found" });
  });

  app.get("/api/rooms", function (req, res) {
    if (!checkKey(req, res)) return;

    res.send({ count: Object.keys(rooms).length, rooms: rooms });
  });

  app.get("/api/rooms/:roomcode", function (req, res) {
    if (!checkKey(req, res)) return;
    const roomcode = req.params.roomcode;
    if (roomcode in rooms) {
      if (roomcode in questionSets) {
        res.send({ room: rooms[roomcode], questions: questionSets[roomcode] });
        return;
      }
      res.send(rooms[roomcode]);
      return;
    }
    res.status(404).send({ error: "Room not found" });
  });

  app.get("/api/publicroomcodes", function (req, res) {
    if (!checkKey(req, res)) return;

    res.send({
      count: publicRoomCodes.length,
      publicRooms: publicRoomCodes,
    });
  });

  app.get("/api/update/categories", async function (req, res) {
    if (!checkKey(req, res)) return;

    await getCategories(categories);
    res.send(categories);
  });

  app.get("/api/update/debug", async function (req, res) {
    if (!checkKey(req, res)) return;

    debug = !debug;
    res.send({ debug: debug });
  });
}

export const debugLog = (message) => {
  if (debug) console.log(message);
};
