import type { Fixture } from "./types";
import { TURTLE_FIXTURES } from "./turtle.fixtures";
import { OWL_FIXTURES } from "./owl.fixtures";
import { FOX_FIXTURES } from "./fox.fixtures";

export type { Fixture, FixtureCategory, ConversationTurn, ExpectedVerdict } from "./types";
export { TURTLE_FIXTURES, OWL_FIXTURES, FOX_FIXTURES };

export const ALL_FIXTURES: Fixture[] = [
  ...TURTLE_FIXTURES,
  ...OWL_FIXTURES,
  ...FOX_FIXTURES,
];
