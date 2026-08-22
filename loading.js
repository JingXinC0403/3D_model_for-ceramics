/* =====================================================
   CARE HUNTSMAN LOADING SYSTEM
===================================================== */


document.addEventListener(
"DOMContentLoaded",
()=>{


    const screen =
    document.getElementById(
    "loading-screen"
    );


    const logo =
    document.getElementById(
    "huntsman-logo"
    );


    const text =
    document.getElementById(
    "loading-text"
    );



    /*
        CHANGE THIS TIME

        This is only a demo timer.
        Later replace it with your
        actual CARE loading complete event.
    */


    setTimeout(()=>{


        finishCARELoading();


    },4000);






    window.finishCARELoading = function(){



        // Change text

        text.innerHTML =
        "Huntsman";



        // Create explosion

        createParticles();




        // explode logo

        logo.classList.add(
        "logo-explode"
        );






        setTimeout(()=>{


            screen.classList.add(
            "loading-hide"
            );



            setTimeout(()=>{


                screen.remove();


            },800);



        },1000);



    }





});







function createParticles(){


    for(
        let i=0;
        i<80;
        i++
    ){



        const particle =
        document.createElement(
        "span"
        );


        particle.className =
        "huntsman-particle";




        particle.style.left =
        "50%";


        particle.style.top =
        "50%";



        const x =
        (Math.random()-0.5)
        *600
        +"px";


        const y =
        (Math.random()-0.5)
        *600
        +"px";



        particle.style.setProperty(
        "--x",
        x
        );


        particle.style.setProperty(
        "--y",
        y
        );



        document.body.appendChild(
        particle
        );



        setTimeout(()=>{


            particle.remove();


        },1000);



    }


}
