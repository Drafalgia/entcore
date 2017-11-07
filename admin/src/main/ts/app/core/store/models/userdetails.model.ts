import { Model } from 'entcore-toolkit'
import { GroupModel } from '../../store/models'

export class UserDetailsModel extends Model<UserDetailsModel> {

    constructor() {
        super({
            sync: '/directory/user/:id',
            update: '/directory/user/:id'
        })
    }

    id?: string
    activationCode?: string
    firstName?: string
    lastName?: string
    displayName?: string
    externalId?: string
    source?: string
    email?: string
    birthDate?: string
    oldemail?: string
    login?: string
    blocked?: boolean
    zipCode: string
    city: string
    address: string
    homePhone: string
    mobile?: string
    type?: Array<string>
    functions?: Array<[string, Array<string>]>
    children?: Array<{id: string, firstName: string, lastName: string, displayName: string, externalId: string}>
    parents?: Array<{id: string, firstName: string, lastName: string, displayName: string, externalId: string}>
    functionalGroups?: GroupModel[]
    manualGroups?: GroupModel[]
    administrativeStructures?: Array<string>
    mergeKey?: string

    toggleBlock() {
        return this.http.put(`/auth/block/${this.id}`, { block: !this.blocked }).then(() => {
            this.blocked = !this.blocked
        })
    }

    sendResetPassword(dest: {type:  string, value: string}) {
        let payload = new window['URLSearchParams']()
        payload.append('login', this.login)
        if (dest.type === 'email') {
            payload.append('email', dest.value)
        } else if (dest.type === 'mobile') {
            payload.append('mobile', dest.value)
        }

        return this.http.post('/auth/sendResetPassword', payload)
    }

    addRelative(parent) {
        return this.http.put(`/directory/user/${this.id}/related/${parent.id}`).then(() => {
            this.parents.push(parent)
        })
    }

    removeRelative(parent) {
        return this.http.delete(`/directory/user/${this.id}/related/${parent.id}`).then(() => {
            this.parents = this.parents.filter(p => p.id !== parent.id)
        })
    }

    addChild(child) {
        return this.http.put(`/directory/user/${child.id}/related/${this.id}`).then(() => {
            this.children.push(child)
        })
    }

    removeChild(child) {
        return this.http.delete(`/directory/user/${child.id}/related/${this.id}`).then(() => {
            this.children = this.children.filter(c => c.id !== child.id)
        })
    }

    addAdml(structureId) {
        return this.http.post(`/directory/user/function/${this.id}`, {
            functionCode: "ADMIN_LOCAL",
            inherit: "s",
            scope: this.functions[0][1] == null ? [structureId] : this.functions[0][1].concat(structureId)
        }).then(async (res) => {
            await this.http.get(`/directory/user/${this.id}/functions`).then((res) => {
                this.functions = res.data[0].functions;
            })
        })
    }

    removeAdml() {
        return this.http.delete(`/directory/user/function/${this.id}/ADMIN_LOCAL`).then(() => {
            this.functions[0] = ["", []]
        })
    }

    isAdml(structureId?: string) {
        return this.functions && this.functions.length > 0 
            && this.functions[0] && this.functions[0].length > 0 
            && this.functions[0][0] === 'ADMIN_LOCAL'
            && this.functions[0][1].includes(structureId)
    }

    generateMergeKey() {
    return this.http.post(`/directory/duplicate/generate/mergeKey/${this.id}`, {}).then((res) => {
            this.mergeKey = res.data.mergeKey
        });
    }

    toJSON() {
        return {
            firstName:      this.firstName,
            lastName:       this.lastName,
            displayName:    this.displayName,
            birthDate:      this.birthDate,
            address:        this.address,
            city:           this.city,
            zipCode:        this.zipCode,
            email:          this.email,
            homePhone:      this.homePhone,
            mobile:         this.mobile
        }
    }
}