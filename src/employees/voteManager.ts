import Lowdb from "lowdb";
import { I_Database, I_Room, I_Vote } from "../typings";
import FileAsync from "lowdb/adapters/FileAsync";
import { Contact, Room, Message, log } from "wechaty";
import { delayQueue } from "../pure-functions/rx-queue";
let root = process.cwd()
export class VoteManager {
   public lowdb: Lowdb.LowdbAsync<I_Database>
   public static manager: VoteManager
   constructor(lowdb: Lowdb.LowdbAsync<I_Database>) {
      this.lowdb = lowdb
      this.lowdb.defaults({
         votes: []
      } as I_Database)
         .write()
   }
   public static async instance() {
      if (!this.manager) {
         let adapter = new FileAsync<I_Database>(`${root}/db.json`)
         let lowdb = await Lowdb(adapter)
         this.manager = new VoteManager(lowdb)
      }
      return this.manager
   }
   getVoteFromDb(query: any) {
      return this.lowdb.get('votes').find(query).value()
   }
   voteUp(mentionId: string, roomId: string) {
      return this.lowdb.get('votes').find({ mentionId, roomId }).update('count', n => n + 1).write()
   }
   async createVote2Db(mentionId: string, roomId: string, voterId: string | undefined) {
      return await this.lowdb.get('votes').push({
         mentionId, roomId, count: 1, voterId: voterId
      }).write()
   }
   getVote(contact: Contact, room: Room) {
      return this.getVoteFromDb({
         mentionId: contact.id,
         roomId: room.id,
      })
   }
   checkVoteSymbol(message: Message, rule: I_Room | undefined) {
      if (rule?.voteSymbol) {
         for (let index = 0; index < rule?.voteSymbol.length; index++) {
            const symbol = rule?.voteSymbol[index];
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
   async delVote(contactId: string, roomId: string, voter: Contact) {
      this.lowdb.get('votes').remove({ mentionId: contactId, roomId, voterId: voter.id })
   }
   async sayBye2WarnOut(room: Room, contact: Contact, rule: I_Room, vote: I_Vote) {
      if (rule.voteOutTemp)
         room.say`${contact} ${rule.voteOutTemp(vote.count, rule.voteCount, contact)}`
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
   async sayWarn(room: Room, contact: Contact, rule: I_Room, vote: I_Vote) {
      await delayQueue(async () => {
         if (rule.warnTemp) {
            await room.say`${contact} ${rule.warnTemp(vote.count, rule.voteCount, contact)}`
         }
      }, `sayWarn() ${contact}`)
   }
   async sayDuplicate(room: Room, voter: Contact, mention: Contact) {
      await delayQueue(async () => {
         room.say`${voter} 你已经警告过 ${mention.name()}, 请不要连续警告.`
      }, `sayDuplicate() room:${room},voter:${voter}`)
   }
   async sayVoteAdmins(room: Room, voter: Contact) {
      room.say`${voter} 请勿警告管理员!`
   }
   async checkVote(message: Message, roomsConfig: I_Room[], admins: string[]) {
      let mentionList = await message.mentionList()
      let room = message.room()
      if (!room) return
      let roomid = room.id
      let topic = await room?.topic()
      let voter = message.from()
      let voterId = voter?.id
      let roomConfig = roomsConfig.find((room) => {
         return (room.topic === topic) || (room.id === roomid)
      })
      if (!roomConfig) return
      // check voteSymbol match
      if (!this.checkVoteSymbol(message, roomConfig)) return
      // check message from room
      for (const mention of mentionList) {
         if (!voter) continue
         if (mention.self()) {
            this.sayVoteAdmins(room, voter)
            continue
         }
         let mentionId = mention.id
         //check if whiteList
         if (roomConfig.whiteList?.includes(mentionId)) {
            this.sayVoteAdmins(room, voter)
            continue
         }
         if (admins.includes(mentionId)) {
            this.sayVoteAdmins(room, voter)
            continue
         }

         if (!this.checkVoteSymbol(message, roomConfig)) continue
         let vote = this.getVote(mention, room)

         // let's set this guy in warned list 🤪
         if (!vote) {
            await this.createVote2Db(mentionId, room.id, voterId)
            let _vote = this.getVote(mention, room)
            this.sayWarn(room, mention, roomConfig, _vote)
            continue
         } else {
            // check vote duplicate by someone  
            if (vote.mentionId == mentionId && vote.voterId == voter.id) {
               await this.sayDuplicate(room, voter, mention)
               continue
            }
            let _vote = await this.voteUp(mentionId, room.id)
            if (vote && vote.count + 1 >= (roomConfig.voteCount || 3)) {
               // let's let's kick this guy out 😈
               this.sayBye2WarnOut(room, mention, roomConfig, vote)
               continue
            }
            this.sayWarn(room, mention, roomConfig, _vote)
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
   isVoteMax(contact: Contact, room: Room, roomConfig: I_Room) {
      let vote = this.getVote(contact, room)
      if (roomConfig.voteCount) {
         if (vote.count >= roomConfig.voteCount) {
            return true
         }
         return false
      }
      return false
   }

}