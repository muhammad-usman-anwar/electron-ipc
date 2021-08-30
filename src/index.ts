import { Subject } from "rxjs";
import { Data, SubjectTypes } from "./types"

export class ElectronIPC {
    private static _instance: ElectronIPC
    private type: SubjectTypes
    private subjects: Subject<Data>[];
    private constructor(type: SubjectTypes) {
        this.type = type
        this.subjects = []
    }

    public static initialize(type = SubjectTypes.SUBJECT): ElectronIPC {
        if (!this._instance) this._instance = new ElectronIPC(type)
        return this._instance
    }

    public static get instance() {
        return this._instance
    }

    private subjectFactory<T>(type = this.type, value?: T) {
        switch (type) {
            case SubjectTypes.SUBJECT:
            default:
                break;

            case SubjectTypes.BEHAVIOR_SUBJECT:
                break;
            case SubjectTypes.REPLAY_SUBJECT:
                break;
            case SubjectTypes.REPLAY_SUBJECT:
                break;
        }
    }

}