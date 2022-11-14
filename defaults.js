export const defaultMapInfo = () => {
  let dict = {};
  for (let i = 0; i < 14; i++) {
    dict[i] = { owner: null, price: 200 };
  }
  return dict;
};
