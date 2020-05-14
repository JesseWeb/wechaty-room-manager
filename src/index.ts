import { log, WechatyPlugin, Wechaty, Friendship } from "wechaty"
import { VoteManager } from "./employees/VoteManager"
import { matchManageRoom } from "./pure-functions/matchManageRoom"
import { I_RoomManager, I_Room } from "./typings"
import { sayHi, checkKnockKnockRoom } from "./employees/doorman"
import { delayQueue } from "./pure-functions/rx-queue"
import { autoKick } from "./employees/HR"
export function manager(options: I_RoomManager): WechatyPlugin {
   let defaultRoomObj: I_Room = {
      id: "23414576835@chatroom",
      topic: "机器人测试群",//either id or topic , using "===" to compare
      voteSymbol: ['[弱]', '/:MMWeak'],
      kickoutSymbol: ["[炸弹]", "/:bome"],
      voteCount: 3,
      kickoutTemp() {
         return "您已被踢出"   //@someone 您已被踢出
      },
      voteOutTemp(count) {
         return `您已被警告${count}次，您已被踢出群聊`  //@someone 您已被警告${count}次，您已被踢出群聊
      },
      warnTemp(count, voteCount) {
         return `您已被其他人警告${count}次，请谨慎发言。警告次数达到${voteCount}将被踢出`
      }
   }
   return (bot: Wechaty) => {
      if (!options) return
      options.rooms = options?.rooms.map((v) => {
         return { ...defaultRoomObj, ...v }
      })
      if (!options.rooms.length) {
         log.warn(`no room in options\nthat means i just siting on my desk do nothing and you still ganna pay me~`)
         return
      }
      bot.on('message', async function (this, message) {
         log.info(`message:${message},from room:${message.room()?.id},sayerId: ${message.from()?.id}`);
         (await VoteManager.instance()).checkVote(message, options.rooms, options.admins);
         (await VoteManager.instance()).checkKick(message, options.rooms, options.admins);
         await checkKnockKnockRoom(this, message, options.rooms)
         await autoKick(message, options.rooms)
      })

      bot.on('room-join', async function (this, room, inviteList) {
         let manageRoom = matchManageRoom(room, options.rooms)
         inviteList.forEach(async (invite) => {
            if (!manageRoom) {
               return
            }
            await sayHi(invite, manageRoom, room)
         });
      })
      bot.on('friendship', async function (this, friendship) {
         let type = friendship.type()
         if (type == Friendship.Type.Receive) {
            if (options.friendshipAcceped)
               await friendship.accept()
         }
         if (type === Friendship.Type.Confirm) {
            let contact = friendship.contact()
            await delayQueue(async () => {
               if (options.hiTemp) {
                  await contact.say(options.hiTemp)
               }
            })

         }
      })
   }
}