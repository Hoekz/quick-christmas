#include <iostream>
#include <string>

using namespace std;

int main(){
	string first, last, email;

	while(cin >> first >> last >> email){
		cout << '"' << email.substr(1, email.size() - 3) << "\": \"" << first << " " << last << "\"," << endl;
	}

	return 0;
}