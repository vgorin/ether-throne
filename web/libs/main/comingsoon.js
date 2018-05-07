var loader1;
var loader2;
var loader3;
var loader4;


$(document).ready(function() {

  loader1 = $('.loader-1').ClassyLoader({width:120,height:120,animate:false,speed:5,percentage:0,diameter: 47,shadowBlur:20,shadowColor:"#25d8ff",showText: false,roundedLine: true,lineColor: 'rgba(39, 234, 255, 1)', remainingLineColor: 'rgba(0, 0, 0, 0.0)',lineWidth: 6});
  loader2 = $('.loader-2').ClassyLoader({width:120,height:120,animate:false,speed:5,percentage:0,diameter: 47,shadowBlur:20,shadowColor:"#25d8ff",showText: false,roundedLine: true,lineColor: 'rgba(39, 234, 255, 1)', remainingLineColor: 'rgba(0, 0, 0, 0.0)',lineWidth: 6});
  loader3 = $('.loader-3').ClassyLoader({width:120,height:120,animate:false,speed:5,percentage:0,diameter: 47,shadowBlur:20,shadowColor:"#25d8ff",showText: false,roundedLine: true,lineColor: 'rgba(39, 234, 255, 1)', remainingLineColor: 'rgba(0, 0, 0, 0.0)',lineWidth: 6});
  loader4 = $('.loader-4').ClassyLoader({width:120,height:120,animate:false,speed:5,percentage:0,diameter: 47,shadowBlur:20,shadowColor:"#25d8ff",showText: false,roundedLine: true,lineColor: 'rgba(39, 234, 255, 1)', remainingLineColor: 'rgba(0, 0, 0, 0.0)',lineWidth: 6});

  loader1g = $('.loader-1-glow').ClassyLoader({width:200,height:200,animate:false,speed:5,percentage:0,diameter: 47,shadowBlur:50,shadowColor:"#25d8ff",showText: false,roundedLine: true,lineColor: 'rgba(39, 234, 255, 1)', remainingLineColor: 'rgba(0, 0, 0, 0.0)',lineWidth: 20});
  loader2g = $('.loader-2-glow').ClassyLoader({width:200,height:200,animate:false,speed:5,percentage:0,diameter: 47,shadowBlur:50,shadowColor:"#25d8ff",showText: false,roundedLine: true,lineColor: 'rgba(39, 234, 255, 1)', remainingLineColor: 'rgba(0, 0, 0, 0.0)',lineWidth: 20});
  loader3g = $('.loader-3-glow').ClassyLoader({width:200,height:200,animate:false,speed:5,percentage:0,diameter: 47,shadowBlur:50,shadowColor:"#25d8ff",showText: false,roundedLine: true,lineColor: 'rgba(39, 234, 255, 1)', remainingLineColor: 'rgba(0, 0, 0, 0.0)',lineWidth: 20});
  loader4g = $('.loader-4-glow').ClassyLoader({width:200,height:200,animate:false,speed:5,percentage:0,diameter: 47,shadowBlur:50,shadowColor:"#25d8ff",showText: false,roundedLine: true,lineColor: 'rgba(39, 234, 255, 1)', remainingLineColor: 'rgba(0, 0, 0, 0.0)',lineWidth: 20});

  //loader1.setPercent(50);
  loader1.draw(0);
  //loader2.setPercent(25);
  loader2.draw(0);
  //loader3.setPercent(10);
  loader3.draw(0);
  //loader4.setPercent(50);
  loader4.draw(0);

  clock();
})


function clock(){

  // set clock
  var t, ss, mm, hh, curentTime, ms;
  var interval;

  var eventD, eventH, eventM, eventS;
  var gint = 1000;
  var dateObject = new Date(eventDateTime);
  var eventTime = dateObject.valueOf();
  var interv1, interv2, interv3, interv4;

  setTimeVars();
  getSrverTime();

  function getSrverTime(){
    $.ajax({
      type: "POST",
      url: "/time.php",
      success: function(data){
        console.log("Success - Event timer");
        curentTime = data*1000;
        startTimer();
      },
      error: function(){
        console.log("Error - Event timer");
        var d = new Date();
        var n = d.getTime();
        curentTime = n;
        startTimer();
      }
    });
  }

  function startTimer(){
    setTimeVars(0);

    $("#days").html( hh);
    $("#hour").html( mm);
    $("#min").html( ss);
    $("#sec").html( ms);

    loader1.setPercent(99.7 - 100/60 * Number(hh));
    loader1.draw(99.7 - 100/60 * Number(hh));
    loader1g.setPercent(99.7 - 100/60 * Number(hh));
    loader1g.draw(99.7 - 100/60 * Number(hh));

    loader2.setPercent(99.7 - 100/24 * Number(mm));
    loader2.draw(99.7 - 100/24 * Number(mm));
    loader2g.setPercent(99.7 - 100/24 * Number(mm));
    loader2g.draw(99.7 - 100/24 * Number(mm));

    loader3.setPercent(99.7 - 100/60 * Number(ss));
    loader3.draw(99.7 - 100/60 * Number(ss));
    loader3g.setPercent(99.7 - 100/60 * Number(ss));
    loader3g.draw(99.7 - 100/60 * Number(ss))

    loader4.setPercent(99.7 - 100/60 * Number(ms));
    loader4.draw(99.7 - 100/60 * Number(ms));
    loader4g.setPercent(99.7 - 100/60 * Number(ms));
    loader4g.draw(99.7 - 100/60 * Number(ms));

    setTimeout(function() {
      // start ticking
      interval = setInterval(function(){
        setTimeVars(gint);

        $("#days").html( hh);
        $("#hour").html( mm);
        $("#min").html( ss);
        $("#sec").html( ms);

        tick();

    }, 1000)

  }, 1000);
  }

  function setTimeVars(t){

    curentTime = curentTime + t;

    if(curentTime < eventTime){

      eventM = (((eventTime-curentTime)/1000)/60);
      eventH = (((eventTime-curentTime)/1000)/60)/60;

      if(eventH>24){
        eventD = parseInt((((eventTime-curentTime)/1000)/60/60)/24);
        eventH = parseInt(eventH - eventD*24);
        if(eventH == 0){
          eventM = parseInt(eventM - (eventD*24)*60);
        }else{
          eventM = parseInt(eventM - ((eventD*24)*60) - eventH*60);
        }
      }else{
        eventH = parseInt(eventH);
        eventD = "00";
        eventM = parseInt(eventM - eventH*60);
      }

      eventS = parseInt(((eventTime-curentTime)/1000) - ((eventD*24)*60)*60 - (eventH*60)*60 - eventM*60);

      ss = String(eventM);
      mm = String(eventH);
      hh = String(eventD);
      ms = String(eventS);
      if (ms.length==1) ms = "0"+ms;
      if (ss.length==1) ss = "0"+ss;
      if (mm.length==1) mm = "0"+mm;
      if (hh.length==1) hh = "0"+hh;

    }else{

      ms="00";
      ss="00";
      mm="00";
      hh="00";

    }

    if (ms=="00" && ss=="00" && mm=="00" && hh=="00"){
      clearInterval(interval);
    }

  }

  function tick(){

    clearInterval(interv1);
    clearInterval(interv2);
    clearInterval(interv3);
    clearInterval(interv4);


    var incr1 = (loader1.getPercent() - (100 - 100/60 * Number(hh)))/100;
    var incr2 = (loader2.getPercent() - (100 - 100/24 * Number(mm)))/100;
    var incr3 = (loader3.getPercent() - (100 - 100/60 * Number(ss)))/100;
    var incr4 = (loader4.getPercent() - (100 - 100/60 * Number(ms)))/100;

    interv1 = setInterval(function(){

    loader1.setPercent(loader1.getPercent() - incr1);
    loader1.show(loader1.getPercent() - incr1);
    loader1g.setPercent(loader1.getPercent() - incr1);
    loader1g.show(loader1.getPercent() - incr1);

  }, 10)

    interv2 = setInterval(function(){

    loader2.setPercent(loader2.getPercent() - incr2);
    loader2.show(loader2.getPercent() - incr2);
    loader2g.setPercent(loader2.getPercent() - incr2);
    loader2g.show(loader2.getPercent() - incr2);

  }, 10)

    interv3 = setInterval(function(){

    loader3.setPercent(loader3.getPercent() - incr3);
    loader3.show(loader3.getPercent() - incr3);
    loader3g.setPercent(loader3.getPercent() - incr3);
    loader3g.show(loader3.getPercent() - incr3);

  }, 10)

    interv4 = setInterval(function(){

    loader4.setPercent(loader4.getPercent() - incr4);
    loader4.show(loader4.getPercent() - incr4);
    loader4g.setPercent(loader4.getPercent() - incr4);
    loader4g.show(loader4.getPercent() - incr4);

  }, 10)

  }

}
