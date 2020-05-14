import { Message } from "wechaty";
import { I_Room } from "src/typings";
import { delayQueue } from "src/pure-functions/rx-queue";
import { matchManageRoom } from "src/pure-functions/matchManageRoom";
import { VoteManager } from "./VoteManager";

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

export async function autoWarn(message: Message, roomsConfig: I_Room[]) {
   let text = message.text()
   let room = message.room()
   let contact = message.from()
   if (!room) return
   let roomConfig = matchManageRoom(room, roomsConfig)
   if (!roomConfig) return
   let autoWarn = roomConfig.autoWarn
   let flag = false
   if (!autoWarn) return
   if (autoWarn.keyword instanceof RegExp) {
      flag = autoWarn.keyword.test(text)
   } else if (typeof autoWarn.keyword === "string") {
      flag = text.includes(autoWarn.keyword)
   }
   await delayQueue(async () => {
      if (room && flag && roomConfig?.autoWarn?.message && contact) {
         let instance = await VoteManager.instance()
         await instance.voteUp(message.id, room.id)
         let vote = instance.getVote(contact, room)
         let isVoteMax =  instance.isVoteMax(contact, room, roomConfig)
         if (!isVoteMax) await instance.sayWarn(room, contact, roomConfig, vote)
         else await instance.sayBye2WarnOut(room, contact, roomConfig, vote)
      }
   })
}