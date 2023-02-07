import fetch from "node-fetch";
import { BACKEND_URL } from "./constants.js";
import { questionSets, rooms } from "./globals.js";

export const getCategories = async (categories) => {
  try {
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

    categories.forEach((category, idx) => {
      category.active = idx < 5;
    });
  } catch (e) {
    console.error(e);
  }
};

export const getQuestionSet = async (roomCode) => {
  try {
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
  } catch (e) {
    console.error(e);
  }
};
