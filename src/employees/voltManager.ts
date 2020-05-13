import Lowdb from "lowdb";
import { I_Database, I_Room, I_Volt } from "../typings";
import FileAsync from "lowdb/adapters/FileAsync";
import { Contact, Room, Message, log } from "wechaty";
import { delayQueue } from "../pure-functions/rx-queue";
let root = process.cwd()
export class VoltManager {
   public lowdb: Lowdb.LowdbAsync<I_Database>
   public static manager: VoltManager
   constructor(lowdb: Lowdb.LowdbAsync<I_Database>) {
      this.lowdb = lowdb
      this.lowdb.defaults({
         volts: []
      } as I_Database)
         .write()
   }
   public static async instance() {
      if (!this.manager) {
         let adapter = new FileAsync<I_Database>(`${root}/db.json`)
         let lowdb = await Lowdb(adapter)
         this.manager = new VoltManager(lowdb)
      }
      return this.manager
   }
   getVoltFromDb(query: any) {
      return this.lowdb.get('volts').find(query).value()
   }
   setVolt2Db(mentionId: string, roomId: string) {
      return this.lowdb.get('volts').find({ mentionId, roomId }).update('count', n => n + 1).write()
   }
   async createVolt2Db(mentionId: string, roomId: string, volterId: string | undefined) {
      return await this.lowdb.get('volts').push({
         mentionId, roomId, count: 1, volterId: volterId
      }).write()
   }
   getVolt(contact: Contact, room: Room) {
      return this.getVoltFromDb({
         mentionId: contact.id,
         roomId: room.id,
      })
   }
   checkVoltSymbol(message: Message, rule: I_Room | undefined) {
      if (rule?.voltSymbol) {
         for (let index = 0; index < rule?.voltSymbol.length; index++) {
            const symbol = rule?.voltSymbol[index];
            if (message.text().includes(symbol)) {
               return true
            }
         }
      }
      return false
   }
   checkKickSymbol(message: Message, rule: I_Room | undefined) {
      if (rule?.kickoutSymbol) {
         for (let index = 0; index < rule?.kickoutSymbol.length; index++) {
            const symbol = rule?.kickoutSymbol[index];
            if (message.text().includes(symbol)) {
               return true
            }
         }
      }
      return false
   }
   async kickout(room: Room, contact: Contact) {
      await room.del(contact)
   }
   async delVolt(contactId: string, roomId: string, volter: Contact) {
      this.lowdb.get('volts').remove({ mentionId: contactId, roomId, volterId: volter.id })
   }
   async sayBye2WarnOut(room: Room, contact: Contact, rule: I_Room, volt: I_Volt) {
      if (rule.voltOutTemp)
         room.say`${contact} ${rule.voltOutTemp(volt.count, rule.voltCount, contact)}`
   }
   async sayBye2KickOut(room: Room | null, contact: Contact | null, roomConfig: I_Room | null | undefined) {
      if (!room) {
         log.info('sayBye2KickOut() argument "room" are undefined')
         return
      }
      if (!contact) {
         log.info('sayBye2KickOut() argument "contact" are undefined')
         return
      }
      if (!roomConfig) {
         log.info('sayBye2KickOut() argument "roomConfig" are undefined')
         return
      }
      if (roomConfig.kickoutTemp)
         room.say`${contact} ${roomConfig.kickoutTemp(contact)}`
   }
   async sayWarn(room: Room, contact: Contact, rule: I_Room, volt: I_Volt) {
      await delayQueue(async () => {
         if (rule.warnTemp) {
            await room.say`${contact} ${rule.warnTemp(volt.count, rule.voltCount, contact)}`
         }
      }, `sayWarn() ${contact}`)
   }
   async sayDuplicate(room: Room, volter: Contact, mention: Contact) {
      await delayQueue(async () => {
         room.say`${volter} 你已经警告过 ${mention.name()}, 请不要连续警告.`
      }, `sayDuplicate() room:${room},volter:${volter}`)
   }
   async sayVoltAdmins(room: Room, volter: Contact) {
      room.say`${volter} 请勿警告管理员!`
   }
   async checkVolt(message: Message, roomsConfig: I_Room[], admins: string[]) {
      let mentionList = await message.mentionList()
      let room = message.room()
      if (!room) return
      let roomid = room.id
      let topic = await room?.topic()
      let volter = message.from()
      let volterId = volter?.id
      let roomConfig = roomsConfig.find((room) => {
         return (room.topic === topic) || (room.id === roomid)
      })
      if (!roomConfig) return
      // check voltSymbol match
      if (!this.checkVoltSymbol(message, roomConfig)) return
      // check message from room
      for (const mention of mentionList) {
         if (!volter) continue
         if (mention.self()) {
            this.sayVoltAdmins(room, volter)
            continue
         }
         let mentionId = mention.id
         //check if whiteList
         if (roomConfig.whiteList?.includes(mentionId)) {
            this.sayVoltAdmins(room, volter)
            continue
         }
         if (admins.includes(mentionId)) {
            this.sayVoltAdmins(room, volter)
            continue
         }

         if (!this.checkVoltSymbol(message, roomConfig)) continue
         let volt = this.getVolt(mention, room)

         // let's set this guy in warned list 🤪
         if (!volt) {
            await this.createVolt2Db(mentionId, room.id, volterId)
            let _volt = this.getVolt(mention, room)
            this.sayWarn(room, mention, roomConfig, _volt)
            continue
         } else {
            // check volt duplicate by someone  
            if (volt.mentionId == mentionId && volt.volterId == volter.id) {
               await this.sayDuplicate(room, volter, mention)
               continue
            }
            let _volt = await this.setVolt2Db(mentionId, room.id)
            if (volt && volt.count + 1 >= (roomConfig.voltCount || 3)) {
               // let's let's kick this guy out 😈
               this.sayBye2WarnOut(room, mention, roomConfig, volt)
               continue
            }
            this.sayWarn(room, mention, roomConfig, _volt)
            continue
         }


      }
   }
   async checkKick(message: Message, roomsConfig: I_Room[], admin: string[]) {
      let kicker = message.from()
      let room = message.room()
      let roomid = room?.id
      let topic = await room?.topic()
      let kickerid = kicker?.id
      // check is room message
      if (!room) return
      //check kicker
      if (!kicker || !kickerid) return

      let roomConfig = roomsConfig.find((config) => {
         return (config.topic === topic) || (config.id === roomid)
      })
      //check room are in the list
      if (!roomConfig) return

      //check admin
      if (!admin.includes(kickerid)) return
      let kickSymbolCheck = this.checkKickSymbol(message, roomConfig)

      // check kick symbol
      if (!kickSymbolCheck) return
      // all check done

      let mentionList = await message.mentionList()

      for (const mention of mentionList) {
         if (!room) continue
         if (mention.self()) continue
         await delayQueue(async () => {
            await this.sayBye2KickOut(room, mention, roomConfig)
            await room?.del(mention)
         })
      }
   }
}