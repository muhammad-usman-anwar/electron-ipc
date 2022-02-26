import { BehaviorSubject, filter } from "rxjs";
import { ChannelState } from "./types";

export class DuplexChannel<U>{
    protected incoming: BehaviorSubject<U>;
    protected outgoing: BehaviorSubject<U>;

    constructor(data: U, state = ChannelState.OUTGOING) {
        if (state !== ChannelState.OUTGOING) {
            this.incoming = new BehaviorSubject(data);
            this.outgoing = new BehaviorSubject(null);
        }
        else {
            this.outgoing = new BehaviorSubject(data);
            this.incoming = new BehaviorSubject(null);
        }
        //this.init();
    }

    public get listen() {
        return this.incoming.pipe(filter(val => val ? true : false));
    }

    public send(data: U) {
        this.outgoing?.next(data);
    }
    /*
        private init() {
            this.outgoing.subscribe(val => {
                if (val) { }
            });
        }
    */
    public close() {
        if (!this.incoming.closed) this.incoming.unsubscribe();
        if (!this.outgoing.closed) this.outgoing.unsubscribe();
    }
}