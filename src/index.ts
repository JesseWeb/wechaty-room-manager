import { log, WechatyPlugin, Wechaty } from "wechaty"
import { VoltManager } from "./employees/voltManager"
import { matchManageRoom } from "./pure-functions/matchManageRoom"
import { I_RoomManager, I_Room } from "./typings"
import { sayHi, checkKnockKnockRoom } from "./employees/doorman"
export function manager(options?: I_RoomManager): WechatyPlugin {
   let defaultRoomObj: I_Room = {
      id: "23414576835@chatroom",
      topic: "机器人测试群",//either id or topic , using "===" to compare
      voltSymbol: ['[弱]', '/:MMWeak'],
      kickoutSymbol: ["[炸弹]", "/:bome"],
      voltCount: 3,
      kickoutTemp() {
         return "您已被踢出"   //@someone 您已被踢出
      },
      voltOutTemp(count) {
         return `您已被警告${count}次，您已被踢出群聊`  //@someone 您已被警告${count}次，您已被踢出群聊
      },
      warnTemp(count, voltCount) {
         return `您已被其他人警告${count}次，请谨慎发言。警告次数达到${voltCount}将被踢出`
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
         (await VoltManager.instance()).checkVolt(message, options.rooms, options.admins);
         (await VoltManager.instance()).checkKick(message, options.rooms, options.admins);
         await checkKnockKnockRoom(this, message, options.rooms)
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
   }
}