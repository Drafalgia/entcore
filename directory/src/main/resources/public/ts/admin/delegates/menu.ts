import { model, _, idiom as lang } from 'entcore';
import { directory } from '../../model';



export interface MenuDelegateScope {

    selectClassroom(classroom: any): void;
    selectedSchool(classroom: any): string;
    openClassList(): void;
    saveClassInfos(): void;
    belongsToMultipleSchools(): boolean;
    listOpened: boolean;
    selectedClass: any;
    
    // from others
    safeApply(a?)
    classrooms: any;

}

export function MenuDelegate($scope: MenuDelegateScope) {

    $scope.classrooms = []

    directory.network.on('classrooms-sync', function () {
		$scope.classrooms = _.filter(directory.network.schools.allClassrooms(), function (classroom) {
			return model.me.classes.indexOf(classroom.id) !== -1;
        });
        if ($scope.classrooms.length > 0) {
            $scope.selectedClass = $scope.classrooms[0];
            model.me.preferences.save('selectedClass', $scope.selectedClass.id);
        }
		directory.classAdmin.sync();
    });

    $scope.selectedSchool = function(classroom) {
        return directory.network.schools.getSchool(classroom.id).name;
    }

    $scope.selectClassroom = function(classroom) {
        $scope.selectedClass = classroom;
        model.me.preferences.save('selectedClass', $scope.selectedClass.id);
        $scope.listOpened = false;
    }

    $scope.openClassList = function () {
        $scope.listOpened = !$scope.listOpened;
    }

    $scope.saveClassInfos = function () {
        directory.classAdmin.name = $scope.selectedClass.name;
        directory.classAdmin.saveClassInfos();
    }

    $scope.belongsToMultipleSchools = function () {
        return directory.network.schools.all.length > 1;
    }

}