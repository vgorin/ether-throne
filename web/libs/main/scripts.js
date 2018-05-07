$(document).ready(function() {

  $('.hero-slider').owlCarousel({
    loop:true,
    margin:400,
    touchDrag:true,
    mouseDrag:true,
    smartSpeed: 500,
    items:1
  })

  $('.slider').owlCarousel({
    loop:false,
    margin:0,
    touchDrag:true,
    mouseDrag:true,
    smartSpeed: 500,
    center:true,
    startPosition:1,
    responsive:{0:{items:1},991:{items:1}, 1000:{items:3}}
  })



  $('.hero-slider').on('translate.owl.carousel', function (event) {

    setTimeout(function() {
      $('.card-section img').removeClass('d-block');
      $('.card-section #c'+event.page.index).addClass('d-block');

    }, 200);
    setTimeout(function() {

      $('.empty').addClass('d-block');

    }, 200);



    $('.card-section').removeClass('card-animate');
    $('.card-section').addClass('empty-animate');

    $('.hero-slider').addClass('visible');
  });

  $('.cards-section .mcard').hover(function() {
    var card = $(this);
    setTimeout(function() {
      card.find('img').removeClass('d-block');
      card.find('.crd').addClass('d-block');
      card.find('.empty').addClass('d-block');
    }, 200);

    $(this).addClass('card-animate');
  }, function() {
    $(this).removeClass('card-animate');
  }
);

  $('.hero-slider').on('translated.owl.carousel', function (event) {

    setTimeout(function() {$('.card-section .empty').removeClass('d-block');}, 200);

    $('.card-section').addClass('card-animate');
    $('.card-section').removeClass('empty-animate');
    $('.hero-slider').removeClass('visible');
  });


  $('.arr.prev').click(function() {
    $('.hero-slider').trigger('prev.owl.carousel');
  })

  $('.arr.next').click(function() {
    $('.hero-slider').trigger('next.owl.carousel');
  })

  $('.arr.left').click(function() {
    $('.slider').trigger('prev.owl.carousel');
  })

  $('.arr.right').click(function() {
    $('.slider').trigger('next.owl.carousel');
  })

  $(window).scroll(function() {
      var x = $(this).scrollTop();
      var o = $('.back-bg').offset().top-500;
      if (x > o) {

      $('.back-bg').css('background-position', '0% ' + parseInt(-(x-o) / 6) + 'px' + ', 0% ' + parseInt(-(x-o) / 10) + 'px, center center');
      }
  });


});
