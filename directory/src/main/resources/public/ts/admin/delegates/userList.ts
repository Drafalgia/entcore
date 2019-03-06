import { User, ClassRoom, UserTypes } from "../model";
import { directoryService } from "../service";
import { template, idiom as lang } from "entcore";
import { EventDelegateScope } from "./events";

enum Column {
    Name,
    Birthdate,
    Login,
    Activation
}
export interface UserListDelegateScope extends EventDelegateScope {
    kinds: {
        Student: UserTypes
        Relative: UserTypes
        Teacher: UserTypes
        Personnel: UserTypes
    };
    columns: typeof Column;
    userList: { selectedTab: UserTypes, selectAll: boolean, search: string };
    switchAll(value?: boolean);
    usersForType(type?: UserTypes): User[]
    selectTab(kind: UserTypes);
    selectedTabCss(kind: UserTypes): string;
    isSelectedTab(kind: UserTypes): boolean;
    displayCode(user: User): string
    displayCodeCss(user: User): string
    sortAsc(column: Column);
    sortDesc(column: Column);
    //
}
export async function UserListDelegate($scope: UserListDelegateScope) {
    //INIT
    let schoolClass: ClassRoom;
    let currentSortDir: "desc" | "asc" = "asc";
    let currentSort: Column = Column.Name;
    template.open('userList', 'admin/user-list');
    $scope.columns = Column;
    $scope.kinds = {
        Personnel: "Personnel",
        Relative: "Relative",
        Student: "Student",
        Teacher: "Teacher"
    };
    $scope.userList = {
        selectAll: false,
        selectedTab: "Student",
        search: ''
    };
    $scope.onClassLoaded.subscribe((s) => {
        schoolClass = s;
        $scope.safeApply();
    })
    //
    const sortUsers = (u1: User, u2: User) => {
        const getter = (u: User) => {
            if (!u) return "";
            switch (currentSort) {
                case Column.Name:
                    return u.safeDisplayName || "";
                case Column.Login:
                    return u.login || "";
                case Column.Activation:
                    return $scope.displayCode(u);
                case Column.Birthdate:
                    return u.inverseBirthDate || "";
            }
            return "";
        }
        const value1 = getter(u1);
        const value2 = getter(u2);
        const res = value1.localeCompare(value2);
        if (currentSortDir == "desc") {
            return -1 * res;
        }
        return res;
    }
    $scope.sortAsc = function (column: Column) {
        currentSort = column;
        currentSortDir = "asc";
        $scope.safeApply();
    }
    $scope.sortDesc = function (column: Column) {
        currentSort = column;
        currentSortDir = "desc";
        $scope.safeApply();
    }
    //
    $scope.usersForType = function (type = $scope.userList.selectedTab) {
        if (!schoolClass) return [];
        const filteredByType = schoolClass.users.filter(u => u.type == type);
        const filteredBySearch = directoryService.findUsers($scope.userList.search, filteredByType);
        return filteredBySearch.sort(sortUsers);
    };
    //
    $scope.isSelectedTab = function (kind) {
        if (!kind) {
            console.warn("[Directory][UserList.isSelectedTab] kind should not be null: ", kind)
        }
        return kind == $scope.userList.selectedTab;
    }
    $scope.selectTab = function (kind) {
        $scope.switchAll(false);
        $scope.userList.search = '';
        $scope.userList.selectedTab = kind;
    }
    $scope.selectedTabCss = function (kind) {
        return $scope.isSelectedTab(kind) ? "selected" : "";
    }
    $scope.switchAll = function (value) {
        if (typeof value != "undefined") {
            $scope.userList.selectAll = value;
        }
        schoolClass.users.forEach(u => {
            if ($scope.isSelectedTab(u.type)) {
                u.selected = $scope.userList.selectAll;
            }
        })
    };
    $scope.displayCode = function (user) {
        if (user.blocked) {
            return lang.translate("directory.blocked.label");
        } else if (user.activationCode) {
            return user.activationCode;
        } else if (user.resetCode) {
            return lang.translate("directory.resetted.label").replace("[[resetCode]]", user.resetCode).replace("[[resetCodeDate]]", user.resetCodeDate)
        } else {
            return lang.translate("directory.activated");
        }
    }
    $scope.displayCodeCss = function (user) {
        if (user.blocked) {
            return "blocked";
        } else if (user.activationCode) {
            return "notactivated";
        } else if (user.resetCode) {
            return "resetted"
        } else {
            return "activated";
        }
    }
}