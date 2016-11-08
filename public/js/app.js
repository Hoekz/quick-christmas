var app = angular.module('app',['firebase']);

app.controller('control', ['$scope','$firebaseAuth','nav','people','memory',function(scope,$auth,nav,people,memory){
    scope.nav = nav;

    var config = {
        apiKey: "AIzaSyAkBsN_Ne7RKopQcSx3LOQkXcl50VQsLho",
        authDomain: "quick-christmas-c1eef.firebaseapp.com",
        databaseURL: "https://quick-christmas-c1eef.firebaseio.com/"
    };

    firebase.initializeApp(config);

    var ref = firebase.database().ref();

    var auth = $auth();
    scope.authenticated = !!auth.$getAuth();
    scope.init = function(){
        auth.$signInWithPopup("google",{scope: 'email'}).then(function(authData){
            var myself = {
                name: authData.user.displayName,
                profile: authData.user.photoURL,
                email: authData.user.email,
                uid: authData.user.uid
            };
            memory.set('me', myself);
            people.add(authData.user.uid, myself);
            scope.myImage = memory.get('me').profile;
            scope.authenticated = true;
            people.grabAll(function(people){
                scope.people = people;
            });
        }).catch(function(error) {
            alert('There was an error logging you in.')
        });
    };
    if(scope.authenticated){
        scope.myImage = memory.get('me').profile;
        people.grabAll(function(people){
            scope.people = people;
        });
    }

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

    scope.createIdea = function(loc){
        people.addIdea(memory.get('me').uid, scope.idea, function(){
            scope.idea = {
                title: '',
                description: '',
                imgs: [],
                links: [],
                time: Firebase.ServerValue.TIMESTAMP
            };
            nav(loc);
        });
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
            time: Firebase.ServerValue.TIMESTAMP
        };
    });
    if(location.hash.length < 2) nav('/');

    window.onhashchange = function(){
        scope.$digest();
    };
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
                    ideas: toArray(person.ideas)
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
        addIdea: function(uid, idea, callback){
            if(!ref) ref = firebase.database().ref().child('members');
            idea = angular.copy(idea);
            idea.time = Firebase.ServerValue.TIMESTAMP;
            ref.child(uid).child('ideas').push(idea, callback);
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