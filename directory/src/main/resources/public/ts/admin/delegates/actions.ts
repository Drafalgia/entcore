import { User } from "../model";
import { EventDelegateScope } from "./events";
import { template } from "entcore";

export interface ActionsDelegateScope extends EventDelegateScope {
    hasSelectedUsers(): boolean;
    selectedUsersAreNotActivated(): boolean;
    selectedUsersAreBlocked(): boolean;
    selectedUsersAreNotBlocked(): boolean;
    confirmRemove();
    canRemoveSelection(): boolean
}
export function ActionsDelegate($scope: ActionsDelegateScope) {
    // === Init template
    template.open('toaster', 'admin/toaster');
    // === Private attributes
    let selection: User[] = [];
    // === Init listener: listen selection changes
    $scope.onSelectionChanged.subscribe(s => {
        selection = s;
    })
    // === Methods
    $scope.hasSelectedUsers = function () {
        return selection.length > 0;
    }
    $scope.selectedUsersAreNotActivated = function () {
        return selection.findIndex((u) => !!u.activationCode) == -1;
    }
    $scope.selectedUsersAreNotBlocked = function () {
        return selection.findIndex((u) => u.blocked) == -1;
    }
    $scope.selectedUsersAreBlocked = function () {
        return selection.findIndex((u) => !u.blocked) == -1;
    }
    $scope.canRemoveSelection = function () {
        return selection.filter((user) => {
            return user.source != 'MANUAL' && user.source != 'CLASS_PARAM' && user.source != 'BE1D' && user.source != 'CSV'
        }).length == 0;
    }
}