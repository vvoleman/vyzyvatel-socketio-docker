import fetch from "node-fetch";
import { BACKEND_URL } from "./constants.js";
import { DEBUG } from "./constants.js";
import { questionSets, rooms } from "./globals.js";

export const getCategories = async (categories) => {
  let response = await fetch(BACKEND_URL + "/api/categories/", {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
    },
  });
  let data = await response.json();

  categories.length = 0;

  data.forEach((category) => {
    categories.push(category);
  });

  categories.forEach((category) => {
    category["active"] = true;
  });

  DEBUG && console.log("Updated Categories: ", categories);
};

export const getQuestionSet = async (roomCode) => {
  const activeCategoryIds = [];
  rooms[roomCode].categories.forEach((category) => {
    if (category.active === true) {
      activeCategoryIds.push(category.id);
    }
  });

  let response = await fetch(BACKEND_URL + "/api/questions/", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ categories: activeCategoryIds }),
  });
  const questions = await response.json();

  questionSets[roomCode] = questions;
};
