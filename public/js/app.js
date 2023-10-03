const app = angular.module('app', ['firebase']);

app.controller('control', ['$scope', '$firebaseAuth', 'nav', 'people', 'memory', (scope, $auth, nav, people, memory) => {
  scope.nav = nav;
  scope.dependents = null;

  const config = {
    apiKey: 'AIzaSyARYtvFj0Hy5Ki2Xcrvs-dqoBs5yu_GD0I',
    authDomain: location.host,
    databaseURL: 'https://quick-christmas-90990.firebaseio.com/'
  };

  firebase.initializeApp(config);

  const ref = firebase.database().ref();

  const auth = $auth();

  auth.$onAuthStateChanged((user) => {
    scope.authenticated = !!user;

    if (scope.authenticated) {
      scope.me = memory.get('me');
      scope.dependents = memory.get('dependents') || null;
      scope.as = scope.me.uid;
      people.grabAll((people) => {
        scope.people = people;
        scope.dependents = people.filter((person) => person?.uid?.match(scope.as) && person?.uid !== scope.as);
        memory.set('dependents', scope.dependents);
      });
    }
  });

  scope.authenticated = false;
  scope.init = () => {
    auth.$signInWithPopup('google', { scope: 'email' }).then((authData) => {
      const num = Math.floor(Math.random() * 5);
      const myself = {
        name: authData.user.displayName || prompt('Please enter your full name'),
        profile: authData.user.photoURL || '/img/defaults/' + num + '.png',
        email: authData.user.email,
        uid: authData.user.uid,
      };
      if (!myself.name || !myself.email) {
        return alert('You do not have permission to access this application.');
      }
      memory.set('me', myself);
      people.add(myself.uid, myself);
      scope.myImage = memory.get('me').profile;
      scope.authenticated = true;
      people.grabAll((people) => scope.people = people);
      scope.me = myself;
    }).catch((error) => {
      alert('There was an error logging you in.');
    });
  };

  scope.search = '';

  scope.isOldIdea = (time) => time < new Date(new Date().getYear() + 1900, 0);

  scope.ideaCount = (ideas) => {
    const count = (ideas || []).filter(idea => scope.isOldIdea(idea.time)).length;
    return count ? (count + ' idea' + ((count === 1) ? '' : 's')) : 'no ideas';
  };

  scope.isNaughty = (person) => person && scope.ideaCount(person.ideas) === 'no ideas';

  scope.naughty = (person) => person.name.match(scope.search) && scope.isNaughty(person);

  scope.nice = (person) => person.name.match(scope.search) && !scope.isNaughty(person);

  scope.createIdea = (navTo, as) => {
    people.addIdea(as || memory.get('me').uid, scope.idea, () => {
      scope.idea = {
        title: '',
        description: '',
        imgs: [],
        links: [],
        time: firebase.database.ServerValue.TIMESTAMP
      };
      nav(navTo);
    });
  };

  scope.delIdea = (index) => people.deleteIdea(scope.person.uid, index, () => {
    scope.person.ideas.splice(index, 1);
  });

  scope.createDependent = (name) => {
    const dependent = {
      name: name,
      profile: scope.me.profile,
      email: scope.me.email,
      uid: scope.me.uid + ' ' + name
    };

    people.addDependent(dependent.uid, dependent);

    const deps = memory.get('dependents') || [];
    deps.push(dependent);
    memory.set('dependents', deps);
    scope.dependents = deps;
    scope.depName = '';
    setTimeout(() => nav('/' + name + '/ideas'), 1000);
  };

  scope.pokePerson = (person) => {
    ref.child('pokes').push({
      name: person.name,
      email: person.email
    });
    alert('This person will receive an email.');
  };

  const updatePeople = () => scope.authenticated && people.grabAll((people) => scope.people = people);

  nav.$route('/', 'home', updatePeople);
  nav.$route('/search', 'search', updatePeople);

  nav.$route('/:person/ideas', 'ideas', (params) => {
    people.grabAll(() => scope.person = people.get(params.person));
  });

  nav.$route('/me', 'me', () => {
    people.grabAll(() => scope.person = people.get(memory.get('me').name));
  });

  nav.$route('/new', 'new', () => scope.idea = {
    title: '',
    description: '',
    imgs: [],
    links: [],
    time: firebase.database.ServerValue.TIMESTAMP,
  });

  nav.$route('/new-dependent', 'newDep', () => scope.depName = '');

  if (location.hash.length < 2) nav('/');

  window.onhashchange = () => scope.$digest();
}]);

app.factory('nav', ['$timeout', ($timeout) => {
  let param = {};
  let lookup = {};
  let response = {};

  const parse = (loc, reg, label) => {
    param = {};
    if (reg instanceof RegExp) {
      var matches = loc.match(reg).slice(1);
      for (let i = 0; i < matches.length; i++) {
        param[lookup[label][i]] = matches[i];
      }
    }
  };

  const adjust = (pattern, label) => {
    if (pattern.indexOf(':') === -1) {
      return pattern;
    }

    lookup[label] = [];
    pattern = pattern.split('/').map((sub) => {
      if (sub[0] === ':') {
        lookup[label].push(sub.substr(1));
        return '([a-zA-z0-9- ]+)';
      } else {
        return sub;
      }
    });

    return new RegExp('^' + pattern.join('/') + '$');
  };

  const nav = (loc) => {
    if (!loc) return false;
    loc = decodeURI(loc);
    for (const label in nav) {
      if (nav.hasOwnProperty(label) && label[0] !== '$') {
        if ((loc.match(nav[label]) && nav[label] instanceof RegExp) || loc === nav[label]) {
          location.hash = loc;
          parse(loc, nav[label], label);
          if (response[label]) {
            response[label](param);
          }
          return true;
        }
      }
    }
    return false;
  };

  nav.$route = (pattern, label, on) => {
    if (typeof pattern === 'string') {
      nav[label] = adjust(pattern, label);
      if (typeof on === 'function') {
        response[label] = on;
      }
    }
  };

  nav.$match = (...patterns) => {
    const loc = decodeURI(location.hash.substring(1));

    return patterns.some(pattern => {
      return ((loc.match(pattern) && pattern instanceof RegExp) || loc === pattern);
    });
  };

  nav.$param = (name) => param[name];

  nav.$open = (route) => window.open(route);

  $timeout(() => {
    if (!nav(location.hash.substring(1))) {
      location.hash = '';
    }
    exports.nav = nav;
  }, 0);

  return nav;
}]);

var exports = {};

app.factory('people', ['$firebaseArray', ($Array) => {
  let ref = null;
  let people = null;

  const toArray = (ideas) => Object.entries(ideas).map(([$key, value]) => ({ ...value, $key }));

  return {
    grabAll(callback) {
      if (!people) {
        ref = firebase.database().ref().child('members');
        people = $Array(ref);
      }
      people.$loaded(() => callback(people));
    },
    get(name) {
      if (!ref) ref = firebase.database().ref().child('members');
      if (people) {
        const person = people.find(person => person.name === name);
        if (!person) return null;
        return {
          name: person.name,
          profile: person.profile,
          email: person.email,
          ideas: toArray(person.ideas),
          uid: person.uid
        };
      } else {
        people = $Array(ref);
        return null;
      }
    },
    add(uid, person) {
      if (!ref) ref = firebase.database().ref().child('members');
      ref.child(uid).update(person);
    },
    addDependent(uid, dependent) {
      if (!ref) ref = firebase.database().ref().child('members');
      ref.child(uid).update(dependent);
    },
    addIdea(uid, idea, callback) {
      if (!ref) ref = firebase.database().ref().child('members');
      idea = angular.copy(idea);
      idea.time = firebase.database.ServerValue.TIMESTAMP;
      ref.child(uid).child('ideas').push(idea, callback);
    },
    deleteIdea(uid, index, callback) {
      if (!ref) ref = firebase.database().ref().child('members');
      var ideas = $Array(ref.child(uid).child('ideas'));
      ideas.$loaded().then(() => ideas.$remove(index)).then(callback);
    },
  };
}]);

app.factory('memory', () => ({
  set: (key, value) => localStorage.setItem(key, JSON.stringify(value)),
  get: (key) => JSON.parse(localStorage.getItem(key)),
}));

app.factory('$exceptionHandler', ['$log', ($log) => (err, cause) => {
  firebase.database().ref()
    .child('errors')
    .child((new Date()).getTime())
    .update({
      message: err.message,
      stack: err.stack
    });
  $log.warn(err, cause);
}]);
