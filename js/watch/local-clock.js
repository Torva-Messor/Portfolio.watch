/** Render the local-time teaser from the visitor's device clock. */
export function renderLocalClock(current = new Date(), root = document) {
  const seconds = current.getSeconds() + current.getMilliseconds() / 1000;
  const minutes = current.getMinutes() + seconds / 60;
  const hours = (current.getHours() % 12) + minutes / 60;
  const hourDegrees = hours * 30;
  const minuteDegrees = minutes * 6;
  const secondDegrees = seconds * 6;
  const hourHand = root.querySelector('#local-clock-hour');
  const minuteHand = root.querySelector('#local-clock-minute');
  const secondHand = root.querySelector('#local-clock-second');
  const timeDisplay = root.querySelector('#local-time');
  if (hourHand) hourHand.style.transform = `rotate(${hourDegrees}deg)`;
  if (minuteHand) minuteHand.style.transform = `rotate(${minuteDegrees}deg)`;
  if (secondHand) secondHand.style.transform = `rotate(${secondDegrees}deg)`;
  if (timeDisplay) {
    timeDisplay.textContent = current.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    timeDisplay.dateTime = current.toISOString();
  }
  return { hourDegrees, minuteDegrees, secondDegrees, isoTime: current.toISOString() };
}
