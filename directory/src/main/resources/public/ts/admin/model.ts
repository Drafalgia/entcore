import { idiom as lang, ui, Model, model } from 'entcore';
import http from 'axios';
import moment = require('moment');

// === Type definitions
type Hobby = { visibility: string, values: string, category: string };
type Structure = { classes: string[], name: string, id: string };
export type UserTypes = "Student" | "Relative" | "Teacher" | "Personnel";

// Person API result
export interface PersonApiResult extends Partial<User> {
    relatedName: string;
    relatedId: string;
    relatedType: UserTypes;
    schools: Structure[];
    hobbies: Hobby[];
}
export type PersonApiResults = { result: PersonApiResult[] };

// Structure API result

export interface StructureApiResult {
    classes: Partial<ClassRoom>[];
    users: Partial<User>[];
}

// School Api Result
export interface SchoolApiResult {
    classes: ClassRoom[];
    users: User[];
}

// === Models
export class User extends Model {
    id: string;
    login: string;
    blocked: boolean;
    type: UserTypes;
    profile: UserTypes;
    resetCode: string;
    activationCode: string;
    mood: "default" = 'default';
    birthDate: string;
    firstName: string;
    lastName: string;
    displayName: string;
    hobbies: Hobby[] = [];
    relatives: User[] = [];
    profiles: UserTypes[] = [];
    attachedStructures: Structure[] = [];
    childrenStructure: Structure[] = []
    selected: boolean;
    constructor(data?: Partial<User>) {
        super(data);
    }
    get safeDisplayName() {
        return this.displayName || `${this.lastName} ${this.firstName}`;
    }
    get resetCodeDate() {
        //TODO
        return "TODO";
    }
    get hasBirthDate() {
        return this.birthDate !== '';
    }
    get shortBirthDate() {
        return this.hasBirthDate ? moment(this.birthDate).format('D/MM/YYYY') : '';
    }
    get inverseBirthDate() {
        return this.hasBirthDate ? moment(this.birthDate).format('YYYYMMDD') : '';
    }
    get isMe() {
        return this.id === model.me.userId;
    }
    get avatar48Uri() {
        return `/userbook/avatar/${this.id}?thumbnail=48x48`;
    }
    get editUserUri() {
        return `/userbook/mon-compte#edit-user/${this.id}`;
    }
    get editUserInfosUri() {
        return `/userbook/mon-compte#edit-user-infos/${this.id}`;
    }
    get isDisabled() {
        return this.blocked || this.isMe;
    }
    updateData(data: Partial<User>) {
        if (data) {
            data.mood = data.mood || 'default';
        }
        super.updateData(data);
    }
    async open() {
        const data: PersonApiResults = (await http.get('/userbook/api/person?id=' + this.id + '&type=' + this.type)).data;
        const firstResult = data.result[0];
        if (!firstResult) {
            this.id = undefined;
            return;
        }
        const hobbies = firstResult.hobbies.filter(hobby => hobby.values);
        const relatives = data.result.filter(item => !!item.relatedId && item.relatedId != "").map(item => new User({ displayName: item.relatedName, id: item.relatedId, type: item.relatedType }));
        const attachedStructures: Structure[] = firstResult.schools;
        if (!data.result[0]) {
            this.id = undefined;
            return;
        }

        this.updateData({ ...data.result[0], hobbies, relatives, attachedStructures });
    }
    async loadChildren() {
        const childrenStructure: Structure[] = (await http.get('/directory/user/' + this.id + '/children')).data;
        this.updateData({ childrenStructure });
    }
    getProfileName() {
        return lang.translate("directory." + this.getProfileType());
    }
    getProfile() {
        return ui.profileColors.match(this.getProfileType());
    }
    getProfileType() {
        if (this.profile)
            return this.profile;
        else if (this.type) {
            return this.type[0];
        }
        else
            this.profiles[0];
    }
}


export class ClassRoom extends Model {
    id: string;
    name: string;
    level: string;
    users: User[] = [];
    constructor(data?: Partial<ClassRoom>) {
        super(data);
    }
}

export class School extends Model {
    id: string;
    name: string;
    users: User[] = [];
    parents: School[] = [];
    children: School[] = [];
    classrooms: ClassRoom[] = [];
    constructor(data?: Partial<School>) {
        super(data);
    }
    updateData(data?: Partial<School> | SchoolApiResult) {
        super.updateData(data);
        if (data) {
            if (data.users) {
                this.users = data.users.map(u => new User(u));
            }
            if ((data as SchoolApiResult).classes) {
                this.classrooms = (data as any).classes.map(u => new ClassRoom(u));
            }
        }
    }
}


export class Network extends Model {
    schools: School[] = [];
    constructor(data?: Partial<Network>) {
        super(data);
    }
    get allClassrooms() {
        let classrooms = [];
        this.schools.forEach((school) => {
            classrooms = classrooms.concat(school.classrooms);
        });
        return classrooms;
    }
    getSchoolByClassId(classId: string): School {
        for (let school of this.schools) {
            for (let classroom of school.classrooms) {
                if (classroom.id === classId) {
                    return school;
                }
            }
        }
        return undefined;
    }
}