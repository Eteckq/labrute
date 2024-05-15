import React, { useState, useEffect } from 'react';
import moment from 'moment';
import Text from '../Text';

const CountdownTimer = () => {
  function calculateTimeLeft() {
    const now = moment.utc().toDate();
    const currentHours = now.getHours();

    let nextActionHour = Math.ceil(currentHours / 3) * 3 + 2;
    if (nextActionHour === 24) {
      nextActionHour = 0;
    }

    console.log(now, nextActionHour);

    const nextActionTime = new Date(now);
    nextActionTime.setHours(nextActionHour, 0, 0, 0);

    const timeDiff = (nextActionTime as never) - (now as never);

    if (timeDiff < 0) {
      nextActionTime.setDate(nextActionTime.getDate() + 1);
    }

    const hours = Math.floor((timeDiff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((timeDiff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((timeDiff % (1000 * 60)) / 1000);

    return { hours, minutes, seconds };
  }

  const [timeLeft, setTimeLeft] = useState(calculateTimeLeft());

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft(calculateTimeLeft());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  return (
    <Text color="error">Prochain combat dans {`${timeLeft.hours}h ${timeLeft.minutes}m ${timeLeft.seconds}s`}</Text>
  );
};

export default CountdownTimer;