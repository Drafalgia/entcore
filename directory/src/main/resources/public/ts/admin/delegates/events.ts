import { Subject } from "rxjs";
import { ClassRoom, Network, User } from "../model";

export interface EventDelegateScope {
    onClassLoaded: Subject<ClassRoom>;
    onNetworkLoaded: Subject<Network>;
    onSelectionChanged: Subject<User[]>;
    safeApply(fn?)
}
export function EventDelegate($scope: EventDelegateScope) {
    $scope.onClassLoaded = new Subject();
    $scope.onNetworkLoaded = new Subject<Network>();
    $scope.onSelectionChanged = new Subject();
    $scope.safeApply = function (fn) {
        const phase = this.$root.$$phase;
        if (phase == '$apply' || phase == '$digest') {
            if (fn && (typeof (fn) === 'function')) {
                fn();
            }
        } else {
            this.$apply(fn);
        }
    };
}