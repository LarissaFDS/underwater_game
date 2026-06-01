import clownFishUrl from "./animals/clown_fish.png";
import hammerSharkUrl from "./animals/hammer_shark.png";
import octopusUrl from "./animals/octopus.png";
import stingrayUrl from "./animals/stingray.png";
import turtleUrl from "./animals/turtle.png";
import blueSubmarineUrl from "./submarines/blue_submarine.png";
import redSubmarineUrl from "./submarines/red_submarine.png";
import heartUrl from "./ui/heart.png";
import oxygenBubbleUrl from "./ui/o2-bubble.png";

export const SPRITE_KEYS = {
  submarine: "submarine",
  submarinePartner: "submarine-partner",
  animalClownfish: "animal-clownfish",
  animalTurtle: "animal-turtle",
  animalOctopus: "animal-octopus",
  animalHammerhead: "animal-hammerhead",
  animalStingray: "animal-stingray",
  heart: "heart",
  oxygenBubble: "oxygen-bubble",
} as const;

export const GAME_ASSETS = [
  { key: SPRITE_KEYS.submarine, url: blueSubmarineUrl },
  { key: SPRITE_KEYS.submarinePartner, url: redSubmarineUrl },
  { key: SPRITE_KEYS.animalClownfish, url: clownFishUrl },
  { key: SPRITE_KEYS.animalTurtle, url: turtleUrl },
  { key: SPRITE_KEYS.animalOctopus, url: octopusUrl },
  { key: SPRITE_KEYS.animalHammerhead, url: hammerSharkUrl },
  { key: SPRITE_KEYS.animalStingray, url: stingrayUrl },
  { key: SPRITE_KEYS.heart, url: heartUrl },
  { key: SPRITE_KEYS.oxygenBubble, url: oxygenBubbleUrl },
] as const;

const ANIMAL_ASSET_KEYS: Record<string, string> = {
  "peixe-palhaco": SPRITE_KEYS.animalClownfish,
  clownfish: SPRITE_KEYS.animalClownfish,
  clown_fish: SPRITE_KEYS.animalClownfish,
  tartaruga: SPRITE_KEYS.animalTurtle,
  turtle: SPRITE_KEYS.animalTurtle,
  polvo: SPRITE_KEYS.animalOctopus,
  octopus: SPRITE_KEYS.animalOctopus,
  "tubarao-martelo": SPRITE_KEYS.animalHammerhead,
  hammerhead: SPRITE_KEYS.animalHammerhead,
  hammer_shark: SPRITE_KEYS.animalHammerhead,
  arraia: SPRITE_KEYS.animalStingray,
  stingray: SPRITE_KEYS.animalStingray,
};

export function getAnimalAssetKey(animalId: string): string {
  return ANIMAL_ASSET_KEYS[animalId] ?? SPRITE_KEYS.animalClownfish;
}
