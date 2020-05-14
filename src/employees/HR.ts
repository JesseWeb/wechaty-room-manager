import { Message } from "wechaty";
import { I_Room } from "../typings";
import { delayQueue } from "../pure-functions/rx-queue";
import { matchManageRoom } from "../pure-functions/matchManageRoom";

export async function autoKick(message: Message, roomsConfig: I_Room[]) {
   let text = message.text()
   let room = message.room()
   let contact = message.from()
   if (!room) return
   let roomConfig = matchManageRoom(room, roomsConfig)
   if (!roomConfig) return
   let autoKick = roomConfig.autoKick
   let flag = false
   if (!autoKick) return
   if (autoKick.keyword instanceof RegExp) {
      flag = autoKick.keyword.test(text)
   } else if (typeof autoKick.keyword === "string") {
      flag = text.includes(autoKick.keyword)
   }
   await delayQueue(async () => {
      if (room && flag && roomConfig?.autoKick?.message && contact) {
         await room.say`${contact} ${roomConfig.autoKick.message}`
         await room.del(contact)
      }
   })
}