var app = angular.module('app',['firebase']);

app.controller('control', ['$scope','$firebaseAuth','nav','people','memory','nameFromEmail',
function(scope,$auth,nav,people,memory,nameFromEmail){
    scope.nav = nav;
    scope.dependents = null;

    var config = {
        apiKey: "AIzaSyAkBsN_Ne7RKopQcSx3LOQkXcl50VQsLho",
        authDomain: "quick-christmas-c1eef.firebaseapp.com",
        databaseURL: "https://quick-christmas-c1eef.firebaseio.com/"
    };

    firebase.initializeApp(config);

    var ref = firebase.database().ref();

    var auth = $auth();

    auth.$onAuthStateChanged(function(user){
        scope.authenticated = !!user;

        if(scope.authenticated){
            scope.me = memory.get('me');
            scope.dependents = memory.get('dependents') || null;
            scope.as = scope.me.uid;
            people.grabAll(function(people){
                scope.people = people;
                scope.dependents = [];

                angular.forEach(people, function(person){
                    if(!!person.uid.match(scope.me.uid) && person.uid != scope.me.uid){
                        scope.dependents.push(person);
                    }
                });

                memory.set('dependents', scope.dependents);
            });
        }
    });

    scope.authenticated = false;
    scope.init = function(){
        auth.$signInWithPopup("google",{scope: 'email'}).then(function(authData){
            var num = Math.floor(Math.random() * 5);
            var myself = {
                name: authData.user.displayName || nameFromEmail[authData.user.email] || prompt("Please enter your full name"),
                profile: authData.user.photoURL || "/img/defaults/" + num + ".png",
                email: authData.user.email,
                uid: authData.user.uid
            };
            if(!myself.name || !myself.email){
                return alert('You do not have permission to access this application.');
            }
            memory.set('me', myself);
            people.add(myself.uid, myself);
            scope.myImage = memory.get('me').profile;
            scope.authenticated = true;
            people.grabAll(function(people){
                scope.people = people;
            });
            scope.me = myself;
        }).catch(function(error) {
            alert('There was an error logging you in.');
        });
    };

    scope.search = "";

    scope.ideaCount = function(ideas){
        if(!ideas) return "no ideas";
        var year = new Date().getYear() + 1900;
        var count = 0;
        angular.forEach(ideas, function(idea){
            if(idea.time > new Date(year,0)) count++;
        });
        if(!count) return "no ideas";
        return count + " idea" + ((count==1)?"":"s");
    };

    scope.isNaughty = function(person){
        return person && scope.ideaCount(person.ideas) == "no ideas";
    };

    scope.naughty = function(item){
        return item.name.match(scope.search) && scope.ideaCount(item.ideas) == "no ideas";
    };

    scope.nice = function(item){
        return item.name.match(scope.search) && scope.ideaCount(item.ideas) !== "no ideas";
    };

    scope.createIdea = function(loc, as){
        people.addIdea(as || memory.get('me').uid, scope.idea, function(res){
            scope.idea = {
                title: '',
                description: '',
                imgs: [],
                links: [],
                time: firebase.database.ServerValue.TIMESTAMP
            };
            nav(loc);
        });
    };

    scope.delIdea = function(index){
        people.deleteIdea(scope.person.uid, index, function(){
            scope.person.ideas.splice(index, 1);
        });
    };

    scope.createDependent = function(name){
        var dependent = {
            name: name,
            profile: scope.me.profile,
            email: scope.me.email,
            uid: scope.me.uid + ' ' + name
        };

        people.addDependent(dependent.uid, dependent);

        var deps = memory.get('dependents');
        if(!deps) deps = [];
        deps.push(dependent);
        memory.set('dependents', deps);
        scope.dependents = deps;
        scope.depName = '';
        setTimeout(function(){
            console.log(scope.dependents);
            nav('/' + name + '/ideas');
        }, 1000);
    };

    scope.pokePerson = function(person){
        ref.child('pokes').push({
            name: person.name,
            email: person.email
        });
        alert('This person will receive an email.');
    };

    nav.$route('/', 'home', function(){
        if(scope.authenticated){
            people.grabAll(function(people){
                scope.people = people;
            });
        }
    });

    nav.$route('/search', 'search', function(){
        if(scope.authenticated){
            people.grabAll(function(people){
                scope.people = people;
            });
        }
    });

    nav.$route('/:person/ideas', 'ideas', function(params){
        people.grabAll(function(){
            scope.person = people.get(params.person);
        });
    });

    nav.$route('/me','me', function(){
        people.grabAll(function(){
            scope.person = people.get(memory.get('me').name);
        });
    });

    nav.$route('/new', 'new', function(){
        scope.idea = {
            title: '',
            description: '',
            imgs: [],
            links: [],
            time: firebase.database.ServerValue.TIMESTAMP
        };
    });

    nav.$route('/new-dependent', 'newDep', function(){
        scope.depName = '';
    });

    if(location.hash.length < 2) nav('/');

    window.onhashchange = function(){scope.$digest();};
}]);

app.factory('nav', ['$timeout', function($timeout){
    var param = {};
    var lookup = {};
    var response = {};

    var parse = function(loc, reg, label){
        param = {};
        if(reg instanceof RegExp){
            var matches = loc.match(reg).slice(1);
            for(var i = 0; i < matches.length; i++){
                param[lookup[label][i]] = matches[i];
            }
        }
    };

    var adjust = function(pattern, label){
        if(pattern.indexOf(':') == -1){
            return pattern;
        }else{
            lookup[label] = [];
            pattern = pattern.split('/').map(function(sub){
                if(sub[0] == ':'){
                    lookup[label].push(sub.substr(1));
                    return "([a-zA-z0-9- ]+)";
                }else{
                    return sub;
                }
            });
            return new RegExp('^' + pattern.join('/') + '$');
        }
    };

    var nav = function(loc){
        if(!loc) return false;
        loc = decodeURI(loc);
        for(var label in nav){
            if(nav.hasOwnProperty(label) && label[0] != '$'){
                if((loc.match(nav[label]) && nav[label] instanceof RegExp) || loc == nav[label]){
                    location.hash = loc;
                    parse(loc, nav[label], label);
                    if(response[label]){
                        response[label](param);
                    }
                    return true;
                }
            }
        }
        return false;
    };

    nav.$route = function(pattern, label, on){
        if(typeof pattern == "string"){
            nav[label] = adjust(pattern, label);
            if(typeof on === "function"){
                response[label] = on;
            }
        }
    };

    nav.$match = function(){
        var patterns = arguments;
        for(var i = 0; i < patterns.length; i++){
            var loc = decodeURI(location.hash.substr(1));
            if((loc.match(patterns[i]) && patterns[i] instanceof RegExp) || loc == patterns[i]){
                return true;
            }
        }
        return false;
    };

    nav.$param = function(name){
        return param[name];
    };

    nav.$open = function(route){
        window.open(route);
    };

    $timeout(function(){
        if(!nav(location.hash.substr(1))){
            location.hash = '';
        }
        exports.nav = nav;
    }, 0);

    return nav;
}]);

var exports = {};

app.factory('people', ['$firebaseArray', function($Array){
    var ref = null;
    var people = null;

    var toArray = function(ideas){
        var arr = [];
        for(var prop in ideas){
            if(ideas.hasOwnProperty(prop)){
                arr.push(ideas[prop]);
                arr[arr.length-1].$key = prop;
            }
        }
        return arr;
    };

    return {
        grabAll: function(callback){
            if(!people){
                ref = firebase.database().ref().child('members');
                people = $Array(ref);
            }
            people.$loaded(function(){
                callback(people);
            });
        },
        get: function(name){
            if(!ref) ref = firebase.database().ref().child('members');
            if(people){
                var person = null;
                angular.forEach(people, function(p){
                    if(p.name == name){
                        person = p;
                    }
                });
                if(!person) return null;
                return {
                    name: person.name,
                    profile: person.profile,
                    email: person.email,
                    ideas: toArray(person.ideas),
                    uid: person.uid
                };
            }else{
                people = $Array(ref);
                return null;
            }
        },
        add: function(uid, person){
            if(!ref) ref = firebase.database().ref().child('members');
            ref.child(uid).update(person);
        },
        addDependent: function(uid, dependent){
            if(!ref) ref = firebase.database().ref().child('members');
            ref.child(uid).update(dependent);
        },
        addIdea: function(uid, idea, callback){
            if(!ref) ref = firebase.database().ref().child('members');
            idea = angular.copy(idea);
            idea.time = firebase.database.ServerValue.TIMESTAMP;
            ref.child(uid).child('ideas').push(idea, callback);
        },
        deleteIdea: function(uid, index, callback){
            if(!ref) ref = firebase.database().ref().child('members');
            var ideas = $Array(ref.child(uid).child('ideas'));
            ideas.$loaded().then(function(){
                return ideas.$remove(index);
            }).then(callback);
        }
    };
}]);

app.factory('memory', function(){
    return {
        set: function(key, value){
            localStorage.setItem(key, JSON.stringify(value));
        },
        get: function(key){
            return JSON.parse(localStorage.getItem(key));
        }
    };
});

app.factory('nameFromEmail', function(){
    return {
        "jquick19@gmail.com": "Jimi Quick",
        "jr_q_jr@yahoo.com": "John Quick",
        "ktfulton6@gmail.com": "Katy Fulton",
        "eeorye44@gmail.com": "Kim Pieper",
        "Kristin.hoekzema@gmail.com": "Kristin Hoekzema",
        "mmquick@aol.com": "Mary Quick",
        "michael.e.quick@gmail.com": "Michael Quick",
        "vharpring@juno.com": "Vicki Harpring",
        "andi.harpring@gmail.com": "Andi Harpring",
        "andrew.s.hoekzema@gmail.com": "Andrew Hoekzema",
        "ashleyp08@hotmail.com": "Ashley Pieper",
        "bhoek4590@gmail.com": "Bethany Hoekzema",
        "erin.eq@gmail.com": "Erin Quick",
        "efquick12@aol.com": "Ethan Quick",
        "hoxema@gmail.com": "Hannah Hoekzema",
        "heather.e.fulton@gmail.com": "Heather Fulton",
        "jdog314159@gmail.com": "James Hoekzema",
        "jharpring@gmail.com": "Jenni Harpring",
        "kellyquick@outlook.com": "Kelly Quick",
        "lfulton14@gmail.com": "Laura Fulton",
        "melfel17@gmail.com": "Melissa Fulton",
        "nathan.fulton@gmail.com": "Nathan Fulton",
        "nora.quick@aol.com": "Nora Quick",
        "sarah.zerbee@gmail.com": "Sarah Zerbee",
        "scratt_007@hotmail.com": "Schelly Pieper"
    };
});