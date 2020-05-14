import { Contact } from "wechaty";

export interface I_Room {
   id?: string,
   topic?: string,
   roomHiTemp?:string,
   warnTemp?(count: number, voteCount: number | undefined, contact: Contact): string,
   kickoutTemp?(contact: Contact): string,
   // enableVote?: boolean,
   knockKnock?:string,
   voteSymbol?: string[],
   kickoutSymbol?: string[],
   voteCount?: number
   voteOutTemp?(count: number, voteCount: number | undefined, contact: Contact): string
   /**
    * only supported wechaty id(account)
    */
   whiteList?: string[]
}
export interface I_RoomManager {
   rooms: I_Room[],

   /**
    * it has to be wechat id(wechat account)--based on Contact.load()
    *  */
   admins: string[],
   friendshipAcceped?: boolean,
   hiTemp?: string,
}

export interface I_Vote {
   mentionId: string,
   roomId: string,
   count: number,
   voteerId: string | undefined | null
}
export interface I_Database {
   votes: I_Vote[]
}