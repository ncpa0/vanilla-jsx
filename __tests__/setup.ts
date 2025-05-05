import { beforeAll } from "vitest";
import { DomInteraction } from "../src/dom/dom-interaction";

beforeAll(() => {
  DomInteraction.prototype.setClass = function(elem, cname) {
    elem.classList.remove(...elem.classList.values());
    elem.classList.add(...cname.split(" ").filter(Boolean));
  };
});
