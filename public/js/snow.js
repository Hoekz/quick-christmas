(function(){
    var canvas = document.querySelector('#snow');
    var ctx = canvas.getContext('2d');
    var flakes = [];

    canvas.width = screen.width;
    canvas.height = screen.height;

    window.onorientationchange = window.onresize = function(){
        canvas.width = Math.max(screen.width, screen.height);
        canvas.height = screen.height;
    };

    var animate = requestAnimationFrame || webkitRequestAnimationFrame || mozRequestAnimationFrame
                                    || oRequestAnimationFrame || msRequestAnimationFrame;

    function draw(){
        ctx.clearRect(0,0,canvas.width,canvas.height);
        ctx.fillStyle = "white";
        for(var i=0;i<flakes.length;i++){
            var w=flakes[i].w*canvas.width,h=flakes[i].h*canvas.height,s=flakes[i].s;
            ctx.fillRect(w,h,s,s);
        }
    }

    function addFlake(){
        var flake = {
            w: Math.random(),
            h: 0,
            s: Math.random()*2 + 0.5,
            v: Math.random()*0.001 +.0005,
            l: Math.floor(Math.random()*300)+400
        };
        flakes.push(flake);
    }

    function updateFlakes(){
        while(Math.random() > 0.5) addFlake();
        for(var i = 0; i < flakes.length; i++){
            if(flakes[i].l--){
                flakes[i].h += flakes[i].v;
            }else{
                flakes.splice(i,1);
                i--;
            }
        }
        draw();
        animate(updateFlakes);
    }

    for(var i = 0; i < Math.random()*500; i++) addFlake();

    animate(updateFlakes);
})();