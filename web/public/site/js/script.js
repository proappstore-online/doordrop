document.addEventListener("DOMContentLoaded", () => {
  /* ==========================================================
     MOBILE MENU TOGGLE
  ========================================================== */
  const menuButton =
    document.getElementById("mobile-menu-button") ||
    document.querySelector("[data-mobile-menu-button]");

  const mobileMenu =
    document.getElementById("mobile-menu") ||
    document.querySelector("[data-mobile-menu]");

  /* ==========================================================
     SMOOTH SCROLLING (Internal links only)
  ========================================================== */
  document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
    anchor.addEventListener("click", function (e) {
      const href = this.getAttribute("href");
      if (!href || href === "#") return;
      const target = document.querySelector(href);
      if (target) {
        e.preventDefault();
        target.scrollIntoView({ behavior: "smooth" });

        // Close mobile menu if open
        if (mobileMenu && !mobileMenu.classList.contains("hidden")) {
          mobileMenu.classList.add("hidden");
          if (menuButton) menuButton.setAttribute("aria-expanded", "false");
        }
      }
    });
  });

  /* ==========================================================
     NAVBAR SCROLL EFFECT
  ========================================================== */
  const navbar = document.getElementById("navbar");
  if (navbar) {
    window.addEventListener("scroll", () => {
      if (window.scrollY > 50) {
        navbar.classList.add("bg-white/95", "shadow-md");
      } else {
        navbar.classList.remove("shadow-md");
      }
    });
  }

  /* ==========================================================
     FAQ TOGGLE
  ========================================================== */
  const faqItems = document.querySelectorAll(".faq-item");

  faqItems.forEach((item) => {
    const question = item.querySelector(".faq-question");
    const answer = item.querySelector(".faq-answer");
    const icon = item.querySelector(".faq-icon");

    question.addEventListener("click", () => {
      const isOpen = item.classList.contains("active");

      // Close all others
      faqItems.forEach((i) => {
        i.classList.remove("active");
        i.querySelector(".faq-answer").style.maxHeight = null;
        i.querySelector(".faq-icon").textContent = "+";
      });

      // Toggle current
      if (!isOpen) {
        item.classList.add("active");
        answer.style.maxHeight = answer.scrollHeight + "px";
        icon.textContent = "\u2212";
      }
    });
  });

  /* ==========================================================
     FEATURE CARD REVEAL ON SCROLL
  ========================================================== */
  const observerOptions = {
    threshold: 0.1,
    rootMargin: "0px 0px -50px 0px",
  };
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.style.opacity = "1";
        entry.target.style.transform = "translateY(0)";
      }
    });
  }, observerOptions);

  document.querySelectorAll(".feature-card").forEach((card) => {
    card.style.opacity = "0";
    card.style.transform = "translateY(30px)";
    card.style.transition = "all 0.6s ease";
    observer.observe(card);
  });

  /* ==========================================================
     SCROLL TO TOP BUTTON
  ========================================================== */
  const scrollBtn = document.getElementById("scrollUpBtn");
  if (scrollBtn) {
    window.addEventListener("scroll", () => {
      if (window.scrollY < 400) {
        scrollBtn.classList.remove("visible");
      } else {
        scrollBtn.classList.add("visible");
      }
    });

    scrollBtn.addEventListener("click", () => {
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  }

  /* ==========================================================
     TESTIMONIAL SLIDE-IN ANIMATION (ON SCROLL)
  ========================================================== */
  document.querySelectorAll(".testimonial-card").forEach((card) => {
    card.style.opacity = "0";
    card.style.transform = "translateY(40px)";
    card.style.transition = "all 0.7s ease";
    observer.observe(card);
  });

  /* ==========================================================
     MOBILE MENU BEHAVIOR (TOGGLE + CLOSE LOGIC)
  ========================================================== */
  if (menuButton && mobileMenu) {
    menuButton.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      mobileMenu.classList.toggle("hidden");
      const expanded = menuButton.getAttribute("aria-expanded") === "true";
      menuButton.setAttribute("aria-expanded", (!expanded).toString());
    });

    // Close menu when clicking a link
    mobileMenu.addEventListener("click", (e) => {
      const clickedAnchor = e.target.closest("a");
      if (!clickedAnchor) return;
      setTimeout(() => {
        mobileMenu.classList.add("hidden");
        menuButton.setAttribute("aria-expanded", "false");
      }, 50);
    });

    // Click outside to close
    document.addEventListener("click", (e) => {
      if (
        !mobileMenu.classList.contains("hidden") &&
        !mobileMenu.contains(e.target) &&
        !menuButton.contains(e.target)
      ) {
        mobileMenu.classList.add("hidden");
        menuButton.setAttribute("aria-expanded", "false");
      }
    });

    // Close on Escape
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && !mobileMenu.classList.contains("hidden")) {
        mobileMenu.classList.add("hidden");
        menuButton.setAttribute("aria-expanded", "false");
      }
    });

    // Close automatically on desktop resize
    window.addEventListener("resize", () => {
      if (
        window.innerWidth >= 768 &&
        !mobileMenu.classList.contains("hidden")
      ) {
        mobileMenu.classList.add("hidden");
        menuButton.setAttribute("aria-expanded", "false");
      }
    });
  }

  /* ==========================================================
     SWIPER TESTIMONIALS
  ========================================================== */
  if (typeof Swiper !== "undefined" && document.querySelector(".testimonialsSwiper")) {
    new Swiper(".testimonialsSwiper", {
      slidesPerView: 1,
      spaceBetween: 30,
      loop: true,
      autoplay: {
        delay: 4000,
        disableOnInteraction: false,
      },
      pagination: {
        el: ".swiper-pagination",
        clickable: true,
      },
      breakpoints: {
        768: { slidesPerView: 2 },
        1024: { slidesPerView: 3 },
      },
    });
  }
});
