import { model, idiom as lang, notify } from "entcore";
import http from 'axios';
import { ClassRoom, User, UserTypes, Network, School, SchoolApiResult } from "./model";
import moment = require("moment");

export const directoryService = {
    async fetchNetwork({ withSchools = false } = {}) {
        const network = new Network;
        const res = await http.get('/userbook/structures');
        const schools = (res.data as School[]).map(s => new School(s));
        schools.forEach(school => {
            school.parents = school.parents.filter(parent => {
                const realParent = schools.find(s => s.id == parent.id);
                if (realParent) {
                    realParent.children = realParent.children ? realParent.children : []
                    realParent.children.push(school)
                    return true
                } else
                    return false
            });
            if (school.parents.length === 0)
                delete school.parents
        });
        network.schools = schools;
        if (withSchools) {
            const promises = network.schools.map(school => directoryService.fetchSchool(school.id, { forSchool: school }))
            await Promise.all(promises);
        }
        return network;
    },
    async fetchSchool(id: string, args: { forSchool?: School } = {}) {
        const res = await http.get('/userbook/structure/' + id);
        const resBody: SchoolApiResult = res.data;
        const school = args.forSchool || new School();
        school.updateData({ id, ...resBody });
        return school;
    },
    async fetchClassById(id: string, { withUsers = false } = {}): Promise<ClassRoom> {
        const resHttp = await http.get(`/directory/class/${id}`);
        const schoolClass = new ClassRoom({ ...resHttp.data, id })
        if (withUsers) {
            schoolClass.users = await directoryService.fetchUsersForClass();
        }
        return schoolClass;
    },
    async  fetchUsersForClass(): Promise<User[]> {
        const resHttp = await http.get('/directory/class/' + model.me.preferences.selectedClass + '/users');
        const res: User[] = resHttp.data;
        const sorted = res.map(r => new User(r)).sort((a, b) => {
            return a.lastName > b.lastName ? 1 : -1;
        });
        return sorted;
    },
    async saveClassInfos(classroom: ClassRoom) {
        await http.put('/directory/class/' + classroom.id, { name: classroom.name, level: classroom.level });
        return classroom;
    },
    async removeUsers(users: User[]) {
        await http.post('/directory/user/delete', { users: users.map(u => u.id) });
        return users;
    },
    findUsers(search: string, users: User[]) {
        const searchTerm = lang.removeAccents(search).toLowerCase();
        if (!searchTerm) {
            return users;
        }
        return users.filter((user) => {
            let testDisplayName = '', testNameReversed = '', testFullName = '', testFullNameReversed = '';
            if (user.displayName) {
                testDisplayName = lang.removeAccents(user.displayName).toLowerCase();
                if (user.displayName.split(' ').length > 0) {
                    testNameReversed = lang.removeAccents(user.displayName.split(' ')[1] + ' '
                        + user.displayName.split(' ')[0]).toLowerCase();
                }
            }
            if (user.firstName && user.lastName) {
                testFullName = lang.removeAccents(user.firstName + ' ' + user.lastName).toLowerCase();
                testFullNameReversed = lang.removeAccents(user.lastName + ' ' + user.firstName).toLowerCase();
            }

            return testDisplayName.indexOf(searchTerm) !== -1 || testNameReversed.indexOf(searchTerm) !== -1
                || testFullName.indexOf(searchTerm) !== -1 || testFullNameReversed.indexOf(searchTerm) !== -1;
        });
    },
    async importFile(file: File, type: UserTypes): Promise<ClassRoom> {
        const form = new FormData();
        form.append(type.replace(/(\w)(\w*)/g, function (g0, g1, g2) { return g1.toUpperCase() + g2.toLowerCase(); }), file);
        form.append('classExternalId', this.externalId);
        try {
            await http.post('upload_file', form, {
                headers: {
                    'Content-Type': 'multipart/form-data'
                }
            })
            //TODO sync class?
        } catch (e) {
            //TODO sync class?
            if (e.response && e.response.data) {
                const error = JSON.parse(e.response.data).message;
                if (error) {
                    const errWithIdx = error.split(/\s/);
                    if (errWithIdx.length === 2) {
                        notify.error(lang.translate(errWithIdx[0]) + errWithIdx[1]);
                    } else {
                        if (error.indexOf('already exists') !== -1) {
                            notify.error('directory.import.already.exists');
                        }
                        else {
                            notify.error(error);
                        }
                    }
                }
            }
        }
        return null;
        //TODO on import finish=> resync class and send an event
        //return directoryService.fetchClass({ withUsers: true });
    },
    async addUser(user: User) {
        const accountData = {
            lastName: user.lastName,
            firstName: user.firstName,
            type: user.type,
            birthDate: moment(user.birthDate).format('YYYY-MM-DD')
        } as any;
        if (user.type === 'Relative') {
            accountData.childrenIds = user.relatives.map(u => u.id);
        }
        const res = await http.post('/directory/class/' + model.me.preferences.selectedClass + '/user', accountData);
        user.updateData(res.data);
        //TODO
        //directory.classAdmin.sync();
        //  directory.directory.sync();
    },
    async grabUser(user: User) {
        const res = await http.put('/directory/class/' + this.id + '/add/' + user.id);
        //TODO
        //  directory.classAdmin.sync();
    },
    blockUsers(value: boolean, users: User[]) {
        //TODO do it in one request
        users.forEach(u => {
            u.blocked = value;
            http.put('/auth/block/' + u.id, { block: value });
        })
    },
    resetPasswords(users: User[]) {
        //TODO do it in one request
        users.forEach(u => {
            http.post('/auth/sendResetPassword', {
                login: u.login,
                email: model.me.email //TODO why my email?
            });
        })
    }
}