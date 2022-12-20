import { isOnline } from "./functions";

test("isOnline", async () => {
  expect(typeof (await isOnline())).toBe("boolean");
});
