import { describe, expect, it } from "vitest";
import { initials, quantity, rupees, shortRupees } from "../format";

describe("format", () => {
  it("uses Indian digit grouping", () => {
    expect(rupees(1617150643)).toBe("1,61,71,506.43");
  });
  it("shortens to lakh and crore", () => {
    expect(shortRupees(1751055443)).toBe("₹1.75 Cr");
    expect(shortRupees(124000000)).toBe("₹12.40 L");
    expect(shortRupees(4521000)).toBe("₹45,210");
  });
  it("shows whole units without decimals and fund units to 3 places", () => {
    expect(quantity(25)).toBe("25");
    expect(quantity(1820.4)).toBe("1,820.400");
  });
  it("makes initials from an email", () => {
    expect(initials("sagar.pathak@example.com")).toBe("SP");
  });
});
