import type { Property } from "@/types";
import { LWN_ADDRESS, LWN_BUILDING } from "@/lib/constants";

export function isLwnRoom(property: Property) {
  return property.building === LWN_BUILDING || property.district === LWN_BUILDING;
}

export function filterLwnRooms(properties: Property[]) {
  return properties.filter(isLwnRoom);
}

export function lwnRoomToProperty(input: {
  name: string;
  price: number;
  area: number;
  status: Property["status"];
  images: string[];
  description?: string;
}) {
  return {
    name: input.name,
    price: input.price,
    area: input.area,
    status: input.status,
    images: input.images,
    description: input.description,
    building: LWN_BUILDING,
    address: LWN_ADDRESS,
    region: "Toshkent shahri",
    district: LWN_BUILDING,
    rooms: 1,
  };
}

export function propertyToLwnForm(property: Property) {
  return {
    name: property.name,
    price: property.price,
    area: property.area,
    status: property.status,
    images: property.images ?? [],
    description: property.description ?? "",
  };
}
