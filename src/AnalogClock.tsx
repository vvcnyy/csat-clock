interface AnalogClockProps {
  seconds: number;
}

export default function AnalogClock({ seconds }: AnalogClockProps) {
  const wholeSeconds = Math.floor(seconds);
  const second = wholeSeconds % 60;
  const minute = (wholeSeconds / 60) % 60;
  const hour = (wholeSeconds / 3600) % 12;

  return (
    <div className="clock" aria-label="아날로그 시계">
      {Array.from({ length: 60 }, (_, index) => (
        <span
          className={index % 5 === 0 ? "tick tick-major" : "tick"}
          key={index}
          style={{ transform: `rotate(${index * 6}deg)` }}
        />
      ))}
      {Array.from({ length: 12 }, (_, index) => (
        <span
          className="clock-number"
          key={index}
          style={{
            left: `${50 + 39 * Math.sin((index * Math.PI) / 6)}%`,
            top: `${50 - 39 * Math.cos((index * Math.PI) / 6)}%`,
          }}
        >
          {index === 0 ? 12 : index}
        </span>
      ))}
      <span className="hand hour" style={{ transform: `rotate(${hour * 30}deg)` }} />
      <span className="hand minute" style={{ transform: `rotate(${minute * 6}deg)` }} />
      <span className="hand second" style={{ transform: `rotate(${second * 6}deg)` }} />
      <span className="clock-pin" />
    </div>
  );
}
