import { Room } from "wechaty";
import { I_Room } from "../typings";
export function matchManageRoom(room: Room, rooms: I_Room[]): I_Room | undefined {

   let r = rooms.find(async (value) => {
      let roomId = room.id
      let roomTopic = await room.topic()
      return (value.id === roomId || roomTopic == value.topic)
   })
   return r
}