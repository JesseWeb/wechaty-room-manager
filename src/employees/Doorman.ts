import { Message, Wechaty, Room, Contact } from "wechaty";
import { I_Room } from "../typings";
import { delayQueue } from "../pure-functions/rx-queue";

export function checkIsFromUser(message: Message) {
   let room = message.room()
   if (!room) return true
   return false
}

export async function checkKnockKnockRoom(wechaty: Wechaty, message: Message, roomsConfig: I_Room[]) {
   let contact = message.from()

   roomsConfig.forEach(async (config) => {
      if (!contact) {
         return
      }
      if (config.knockKnock == message.text()) {
         if (config.id) {
            let _room = wechaty.Room.load(config.id)
            if (_room) {
               _room.add(contact)
            }
         } else if (config.topic) {
            let _room = await wechaty.Room.find({ topic: config.topic })
            if (_room) {
               _room.add(contact)
            }
         }
      }
   })
}
export async function sayHi(invite: Contact, roomConfig: I_Room, room: Room) {
   if (roomConfig.roomHiTemp) {
      await delayQueue(async () => {
         await room.say`${invite} ${roomConfig?.roomHiTemp}`
      }, `roomJoin say ${invite} ${roomConfig?.roomHiTemp}`)
   }


}