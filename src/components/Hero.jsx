import { useMemo } from 'react'

function Hero() {
  const stars = useMemo(() => {
    return Array.from({ length: 350 }, (_, index) => ({
      id: index,
      left: `${Math.random() * 100}%`,
      top: `${Math.random() * 100}%`,
      size: `${Math.random() * 1.5 + 0.5}px`,
      duration: `${Math.random() * 18 + 12}s`,
      delay: `${Math.random() * -30}s`,
      opacity: Math.random() * 0.55 + 0.2,
      drift: `${Math.random() * 80 - 40}px`,
    }))
  }, [])

  return (
    <section id="hero" aria-label="Yash portfolio landing page">

      <div className="stars" aria-hidden="true">
        <div className="stars-track">
  <div className="stars-tile">
    {stars.map((star) => (
      <span
        key={star.id}
        className="star"
        style={{
          left: star.left,
          top: star.top,
          width: star.size,
          height: star.size,
          opacity: star.opacity,
          '--star-duration': star.duration,
          '--star-delay': star.delay,
        }}
      />
    ))}
  </div>

  <div className="stars-tile">
    {stars.map((star) => (
      <span
        key={`duplicate-${star.id}`}
        className="star"
        style={{
          left: star.left,
          top: star.top,
          width: star.size,
          height: star.size,
          opacity: star.opacity,
          '--star-duration': star.duration,
          '--star-delay': star.delay,
        }}
      />
    ))}
  </div>
</div>
      </div>

      <div className="hero-inner">
        <div className="hero-name">YASH</div>

        <div className="hero-role">
          EMBEDDED/ROBOTICS
        </div>

        <div className="hero-rule"></div>

        <div className="hero-tagline">
          Making machines see, feel and act
        </div>
      </div>

      <div className="hero-scroll" aria-hidden="true">
        scroll
      </div>

    </section>
  )
}

export default Hero