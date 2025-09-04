// Quick test script to simulate daily reset
// Run this in browser console to test the reset logic

// Get the current completedToday calculation
const testDate = new Date();
const yesterday = new Date(testDate);
yesterday.setDate(yesterday.getDate() - 1);

console.log('Today:', testDate.toDateString());
console.log('Yesterday:', yesterday.toDateString());

// Test the date comparison logic
const testCompletedAt = new Date(); // Simulate a task completed "today"
const testCompletedYesterday = new Date();
testCompletedYesterday.setDate(testCompletedYesterday.getDate() - 1); // Simulate "yesterday"

console.log('Task completed today:', testCompletedAt.toDateString() === testDate.toDateString());
console.log('Task completed yesterday:', testCompletedYesterday.toDateString() === testDate.toDateString());

// This should show how the filtering works
console.log('Today filter would include today task:', testCompletedAt.toDateString() === testDate.toDateString());
console.log('Today filter would exclude yesterday task:', testCompletedYesterday.toDateString() === testDate.toDateString());
