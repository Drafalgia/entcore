var replaceAvatars = function(){
	$('.avatar').each(function(index, item){
		$('<div></div>').css({
			'background-image': 'url(' + $(item).find('img').attr('src') + ')'
		}).addClass('avatar-image').appendTo(item);
		$(item).find('img').remove();
	})
}

var userbook = function(){

	var classDataAdaptor = function (d) {
		var listStudents = [];
		var listTeachers = [];
		for (obj in d.result){
			if (d.result[obj].userId !== d.result[obj].id){
				d.result[obj].mood= 'default';
				d.result[obj].photo= '';
			}
			if (d.result[obj].type === 'ELEVE'){
				listStudents.push(d.result[obj]);
			} else if (d.result[obj].type === 'ENSEIGNANT'){
				listTeachers.push(d.result[obj]);
			}
		}
		return {
			students: listStudents,
			anyStudent: listStudents.length > 0,
			teachers: listTeachers,
			anyTeacher: listTeachers.length > 0
		};
	};
	var searchDataAdaptor = function (d) {
		var listStudents = [];
		var listTeachers = [];
		var listParents = [];
		for (obj in d.result){
			if (d.result[obj].photo ==='' && d.result[obj].mood ==='' && d.result[obj].userId === ''){
				d.result[obj].mood= 'default';
			}
			if (d.result[obj].type === 'ELEVE'){
				listStudents.push(d.result[obj]);
			} else if (d.result[obj].type === 'ENSEIGNANT'){
				listTeachers.push(d.result[obj]);
			} else {
				listParents.push(d.result[obj]);
			}
		}
		return {
			students: listStudents,
			anyStudent: listStudents.length > 0,
			teachers: listTeachers,
			anyTeacher: listTeachers.length > 0,
			parents: listParents,
			anyParent: listParents.length > 0
		};
	};

	var personDataAdaptor = function(d) {
		var person = d.result[0];

		person['hobbies'] = [];
		d.result[0].category.forEach(function(c,index){
			person['hobbies'].push({"category" : c, "values" : d.result[0].values[index]});
		});

		person['relations'] = [];
		_.values(d.result).forEach(function(o){
			person['relations'].push(_.pick(o, 'relatedId', 'relatedName','relatedType'));
		});

		return person;
	};

	var app = Object.create(oneApp);
	app.scope = ".annuaire";
	app.define({
		template : {
			searchResults: '\
				{{#anyTeacher}}\
					<h1>{{#i18n}}userBook.teachers{{/i18n}}</h1>\
				{{/anyTeacher}}\
				{{#teachers}}\
				<div class="cell four text-container" >\
					<article class="box row person text-container" id={{id}}>\
							<div class="four cell avatar"><img src="document/{{photo}}?userbook-dimg=public%2Fimg%2Fno-avatar.jpg" alt="user" /></div>\
							<div class="six cell">\
								<div class="row">\
									<h4 href="api/person?id={{id}}&type={{type}}" call="person">{{displayName}}</h4>\
								</div>\
								<div class="row bottom-locked">\
									<span class="actions">\
									<i role="send-mail"></i>\
									<i role="view-book"></i>\
									<i role="view-folder"></i>\
								</span>\
								</div>\
							</div>\
							<div class="two cell"><i role="{{mood}}-panda" class="liquid"></i></div>\
					</article>\
				</div>\
				{{/teachers}}\
				<div class="clear"></div>\
				{{#anyParent}}\
					<h1>{{#i18n}}userBook.parents{{/i18n}}</h1>\
				{{/anyParent}}\
				{{#parents}}\
				<div class="cell four text-container" >\
					<article class="box row person text-container" id={{id}}>\
							<div class="four cell avatar"><img src="document/{{photo}}?userbook-dimg=public%2Fimg%2Fno-avatar.jpg" alt="user" /></div>\
							<div class="six cell">\
								<div class="row">\
									<h4 href="api/person?id={{id}}&type={{type}}" call="person">{{displayName}}</h4>\
								</div>\
								<div class="row bottom-locked">\
									<span class="actions">\
									<i role="send-mail"></i>\
									<i role="view-book"></i>\
									<i role="view-folder"></i>\
								</span>\
								</div>\
							</div>\
							<div class="two cell"><i role="{{mood}}-panda" class="liquid"></i></div>\
					</article>\
				</div>\
				{{/parents}}\
				<div class="clear"></div>\
				{{#anyStudent}}\
					<h1>{{#i18n}}userBook.students{{/i18n}}</h1>\
				{{/anyStudent}}\
				{{#students}}\
				<div class="cell four text-container" >\
					<article class="box row person text-container" id={{id}}>\
							<div class="four cell avatar"><img src="document/{{photo}}?userbook-dimg=public%2Fimg%2Fno-avatar.jpg" alt="user" /></div>\
							<div class="six cell">\
								<div class="row">\
									<h4 href="api/person?id={{id}}&type={{type}}" call="person">{{displayName}}</h4>\
								</div>\
								<div class="row bottom-locked">\
									<span class="actions">\
									<i role="send-mail"></i>\
									<i role="view-book"></i>\
									<i role="view-folder"></i>\
								</span>\
								</div>\
							</div>\
							<div class="two cell"><i role="{{mood}}-panda" class="liquid"></i></div>\
					</article>\
				</div>\
				{{/students}}',
			personne: '\
				<div class="row fixed-block height-four">\
					<div class="text-container fixed cell four">\
						<div class="avatar twelve fluid cell">\
							<img src="document/{{photo}}?userbook-dimg=public%2Fimg%2Fno-avatar.jpg" alt="user" />\
						</div>\
					</div>\
					<div class="fixed cell eight text-container right-magnet">\
						<article class="cell twelve text-container fluid">\
							<h2>{{displayName}}</h2>\
							<div class="row">\
								<div class="four cell">{{#i18n}}userBook.profile.email{{/i18n}}</div>\
								<em class="eight cell">{{email}}</em>\
							</div>\
							<div class="row">\
								<div class="four cell">{{#i18n}}userBook.profile.address{{/i18n}}</div>\
								<em class="eight cell">{{address}}</em>\
							</div>\
							<div class="row">\
								<div class="four cell">{{#i18n}}userBook.profile.motto{{/i18n}}</div>\
								<em class="eight cell">{{motto}}</em>\
							</div>\
							<div class="row mini-box">\
								<div class="two cell avatar"><i role="{{mood}}-panda" class="liquid"></i></div>\
								<em class="ten cell text-container mood">{{#i18n}}userBook.mood.{{mood}}{{/i18n}}</em>\
							</div>\
						</article>\
					</div>\
				</div>\
				<div class="row text-container">\
					<article id="actions" class="row text-container">\
					<div class="row mini-box">\
						<div class="cell one"><i role="send-mail"></i></div>\
						<a class="cell ten"><h3>{{#i18n}}userBook.class.write-message{{/i18n}}</h3></a>\
					</div>\
					<div class="row mini-box">\
						<div class="cell one"><i role="view-book"></i></div>\
						<a class="cell ten"><h3>{{#i18n}}userBook.class.edit-notebook{{/i18n}}</h3></a>\
					</div>\
					<div class="row mini-box">\
						<div class="cell one"><i role="view-folder"></i></div>\
						<a class="cell ten"><h3>{{#i18n}}userBook.class.see-portfolio{{/i18n}}</h3></a>\
					</div>\
					<div class="clear"></div>\
				</article>\
				</div>\
				<h1 class="clear mini-box">{{#i18n}}userBook.profile.family{{/i18n}}</h1>\
				<article class="text-container">\
					{{#relations}}\
						<p>\
							<a href="api/person?id={{relatedId}}&type={{relatedType}}" call="person">{{relatedName}}</a>\
						</p>\
					{{/relations}}\
				</article>\
				<h1>{{#i18n}}userBook.interests{{/i18n}}</h1>\
				<article class="text-container">\
					{{#hobbies}}\
					<div class="row line">\
						<div class="three cell">{{#i18n}}userBook.hobby.{{category}}{{/i18n}}</div>\
						<div class="eight cell"><em>{{values}}</em></div>\
						<div class="one cell"></div>\
						<div class="clear"></div>\
					</div>\
					{{/hobbies}}\
					<div class="clear"></div>\
				</article>\
				<h1>{{#i18n}}userBook.profile.health{{/i18n}}</h1>\
				<article class="text-container user-content">{{health}}</article>\
	'
		},
		action : {
			search : function(o){
				var url = o.target.form.action + '?' + $('#search-form').serialize();
				One.get(url)
				.done(function(data){
					$("#people").removeClass('four').addClass('twelve');
					$("#person").html('');
					if (data.result[0] === undefined) {
						app.notify.info("Aucun résultat");
						$("#people").html('');
						$("#person").html('');
					} else {
						$("#people").html(app.template.render('searchResults', searchDataAdaptor(data)));
					}

					messenger.requireResize();
				})
				.error(function(data){app.notify.error(data.status);});
			},
			showList: function(){
				this.refreshClassList();
			},
			refresh: function(){
				window.location.reload();
			},
			showPerson: function(data){
				$("#people .text-container.four").addClass('twelve').removeClass('four');
				$("#people").addClass('four').removeClass('twelve');
				$("#people .selected").removeClass('selected');
				if (data.result[0].type !== 'PERSRELELEVE'){
					$('#' + data.result[0].id).addClass('selected');
				}
				$("#person").html(app.template.render('personne', personDataAdaptor(data)));
				$('i[role=show-icons]').removeClass('selected');
				$('i[role=show-details]').addClass('selected');
			},
			showFirstPerson: function(){
				var that = this;
				One.get($('.person').first().find('h4').attr('href'))
					.done(function(data){
						that.showPerson(data);
						messenger.requireResize();
					});
			},
			person : function(o){
				var that = this;
				One.get(o.url)
					.done(function(data){
						that.showPerson(data);
						messenger.requireResize();
					});
			},
			refreshClassList: function(){
				if (location.search.substring(1,8) === 'myClass'){
					userbook.action.searchClass("api/class");
				}
			},
			searchClass : function(url) {
				One.get(url)
				.done(function(data){
					$("#people .text-container.twelve").addClass('four').removeClass('twelve');
					$("#people").removeClass('four').addClass('twelve');
					$("#people .selected").removeClass('selected');
					$('#person').html('');
					if (data.result[0] === undefined) {
						app.notify.info("Aucun résultat");
						$("#people").html('');
						$("#person").html('');
					} else {
						$("#people").html(app.template.render('searchResults', classDataAdaptor(data)));
					}
						replaceAvatars();
					messenger.requireResize();
				});
			}
		}
	});
	return app;
}();


$(document).ready(function(){
	userbook.init();
	userbook.action.refreshClassList();
	if (location.href.indexOf("#",0)!==-1){
		var id = location.href.split("#")[1];
		$('#people').remove();
		$('#person').removeClass('eight').addClass('twelve');
		$('.annuaire').first().remove();
		$('.search').remove();
		userbook.action.person(
			{"url":"api/person?id="+ location.href.split("#")[1] + "&type=" + location.href.split("#")[2]}
		);
	}
});
