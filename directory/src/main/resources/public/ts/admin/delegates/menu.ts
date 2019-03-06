import { model, _, idiom as lang } from 'entcore';
import { EventDelegateScope } from "./events";
import { ClassRoom, Network } from '../model';
import { directoryService } from '../service';


export interface MenuDelegateScope extends EventDelegateScope {
    selectClassroom(classroom: ClassRoom): void;
    selectedSchool(classroom: ClassRoom): string;
    openClassList(): void;
    saveClassInfos(): void;
    belongsToMultipleSchools(): boolean;
    listOpened: boolean;
    selectedClass: ClassRoom;
    // from others
    classrooms: ClassRoom[];

}

export function MenuDelegate($scope: MenuDelegateScope) {
    // === Private methods
    const setSelectedClassById = async function (classroomId: string) {
        if (classroomId) {
            model.me.preferences.save('selectedClass', classroomId);
            const fetched = await directoryService.fetchClassById(classroomId, { withUsers: true });
            $scope.selectedClass = fetched;
            $scope.onClassLoaded.next(fetched);
        } else {
            console.warn("[Directory][Menu.setSelectedClassById] trying to select an undefined classroom: ", classroomId);
            $scope.selectedClass = null;
        }
    }
    const setSelectedClass = async function (classroom: ClassRoom) {
        $scope.selectedClass = classroom;
        setSelectedClassById(classroom.id);

    }
    const getPreferenceClassId = function () {
        return model.me.preferences.selectedClass;
    }
    // === Init attributes
    $scope.classrooms = [];
    let network: Network;
    // === listen network changes to load my class
    $scope.onNetworkLoaded.subscribe(network => {
        $scope.classrooms = network.allClassrooms.filter((classroom) => {
            return model.me.classes.indexOf(classroom.id) !== -1;
        });
        if ($scope.classrooms.length > 0) {
            setSelectedClass($scope.classrooms[0]);
        }
    });
    // === Init class from preference
    const init = () => {
        let myClassId = getPreferenceClassId();
        if (!myClassId) {
            myClassId = model.me.classes[0];
        }
        setSelectedClass(myClassId);
    }
    init();
    // === Methods
    $scope.selectedSchool = function (classroom) {
        return network && network.getSchoolByClassId(classroom.id).name;
    }

    $scope.selectClassroom = function (classroom) {
        setSelectedClass(classroom);
        $scope.listOpened = false;
    }

    $scope.openClassList = function () {
        $scope.listOpened = !$scope.listOpened;
    }

    $scope.saveClassInfos = function () {
        directoryService.saveClassInfos($scope.selectedClass);
    }

    $scope.belongsToMultipleSchools = function () {
        return network.schools.length > 1;
    }

}