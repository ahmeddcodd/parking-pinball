/** Car cosmetic skins. Index in this array = car id in save data. */
export interface CarSkin {
  name: string;
  body: string; // hex body color
  accent: string; // roof / cabin color
  cost: number; // coins; 0 = starter car
}

export const CARS: CarSkin[] = [
  { name: "Cherry Zip", body: "#ff5252", accent: "#ffd1d1", cost: 0 },
  { name: "Taxi Toon", body: "#ffcf3f", accent: "#fff3c4", cost: 150 },
  { name: "Minty Go", body: "#4cd6a9", accent: "#d4fbef", cost: 300 },
  { name: "Bubble Blue", body: "#55a8f5", accent: "#d6ecff", cost: 450 },
  { name: "Grape Escape", body: "#a06bf0", accent: "#ecdcff", cost: 650 },
  { name: "Tiger Lily", body: "#ff8b3c", accent: "#ffe2c4", cost: 850 },
  { name: "Panther", body: "#3a4358", accent: "#8e9ab5", cost: 1100 },
  { name: "Golden Park", body: "#f0c419", accent: "#fdf1bd", cost: 1500 },
];
