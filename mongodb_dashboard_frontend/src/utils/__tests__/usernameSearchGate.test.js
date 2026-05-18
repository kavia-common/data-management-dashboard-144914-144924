import { evaluateUsernameSearchInput } from "../usernameSearchGate";

describe("evaluateUsernameSearchInput", () => {
  test("empty -> shouldSearch false", () => {
    expect(evaluateUsernameSearchInput("")).toEqual({ shouldSearch: false, normalized: "" });
    expect(evaluateUsernameSearchInput("   ")).toEqual({ shouldSearch: false, normalized: "" });
    expect(evaluateUsernameSearchInput(null)).toEqual({ shouldSearch: false, normalized: "" });
  });

  test("single short token -> shouldSearch false", () => {
    expect(evaluateUsernameSearchInput("Ad")).toEqual({ shouldSearch: false, normalized: "Ad" });
    expect(evaluateUsernameSearchInput("Adi")).toEqual({ shouldSearch: false, normalized: "Adi" });
    expect(evaluateUsernameSearchInput("Adit")).toEqual({ shouldSearch: false, normalized: "Adit" });
  });

  test("single token length >= 5 -> shouldSearch true", () => {
    expect(evaluateUsernameSearchInput("Aditi")).toEqual({ shouldSearch: true, normalized: "Aditi" });
  });

  test("two tokens -> shouldSearch true", () => {
    expect(evaluateUsernameSearchInput("Aditi S")).toEqual({ shouldSearch: true, normalized: "Aditi S" });
    expect(evaluateUsernameSearchInput("  Aditi   S ")).toEqual({
      shouldSearch: true,
      normalized: "Aditi S",
    });
  });
});
