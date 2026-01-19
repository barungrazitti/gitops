/**
 * Progress Tracker - Enhanced progress indication and feedback
 */

const chalk = require('chalk');
const ora = require('ora');

class ProgressTracker {
  constructor() {
    this.steps = [];
    this.currentStep = 0;
    this.spinner = null;
    this.startTime = null;
    this.options = {
      showElapsedTime: true,
      detailedFeedback: true,
      stepTracking: true
    };
  }

  /**
   * Initialize progress tracking
   */
  init(options = {}) {
    this.options = { ...this.options, ...options };
    this.startTime = Date.now();
    return this;
  }

  /**
   * Add a step to the process
   */
  addStep(name, description, weight = 1) {
    this.steps.push({
      name,
      description,
      weight,
      status: 'pending', // pending, in-progress, completed, failed
      startTime: null,
      endTime: null,
      duration: null
    });
    return this;
  }

  /**
   * Start tracking a specific step
   */
  startStep(stepName) {
    const step = this.steps.find(s => s.name === stepName);
    if (!step) {
      throw new Error(`Step not found: ${stepName}`);
    }

    // Update previous step if any
    if (this.currentStep > 0) {
      const prevStep = this.steps[this.currentStep - 1];
      if (prevStep.status === 'in-progress') {
        prevStep.status = 'completed';
        prevStep.endTime = Date.now();
        prevStep.duration = prevStep.endTime - prevStep.startTime;
      }
    }

    step.status = 'in-progress';
    step.startTime = Date.now();
    this.currentStep = this.steps.indexOf(step);

    // Update spinner
    const elapsed = this.options.showElapsedTime ? 
      ` [${this.getFormattedTime(Date.now() - this.startTime)}]` : '';
    
    const message = this.options.detailedFeedback ?
      `${step.description}${elapsed}` :
      `${step.name}${elapsed}`;
    
    if (this.spinner) {
      this.spinner.text = message;
    } else {
      this.spinner = ora({
        text: message,
        spinner: 'clock'
      }).start();
    }

    return this;
  }

  /**
   * Complete the current step
   */
  completeStep(stepName, success = true) {
    const step = this.steps.find(s => s.name === stepName);
    if (!step) {
      throw new Error(`Step not found: ${stepName}`);
    }

    step.status = success ? 'completed' : 'failed';
    step.endTime = Date.now();
    step.duration = step.endTime - step.startTime;

    if (success) {
      const elapsed = step.duration ? 
        ` (${this.getFormattedTime(step.duration)})` : '';
      this.spinner?.succeed(`${step.description}${elapsed}`);
    } else {
      this.spinner?.fail(`${step.description} - Failed`);
    }

    return this;
  }

  /**
   * Update progress with custom message
   */
  updateProgress(message, details = {}) {
    const elapsed = this.options.showElapsedTime ? 
      ` [${this.getFormattedTime(Date.now() - this.startTime)}]` : '';
    
    const fullMessage = this.options.detailedFeedback ?
      `${message}${details.progress ? ` (${details.progress})` : ''}${elapsed}` :
      `${message}${elapsed}`;
    
    if (this.spinner) this.spinner.text = fullMessage;
    
    return this;
  }

  /**
   * Show detailed progress information
   */
  showDetailedProgress() {
    const completedSteps = this.steps.filter(s => s.status === 'completed').length;
    const totalSteps = this.steps.length;
    const progress = totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0;
    
    const elapsed = this.getFormattedTime(Date.now() - this.startTime);
    
    console.log(chalk.blue(`\n📊 Progress: ${completedSteps}/${totalSteps} steps completed (${progress}%)`));
    console.log(chalk.blue(`⏱️  Elapsed time: ${elapsed}`));
    
    if (this.currentStep < this.steps.length) {
      const current = this.steps[this.currentStep];
      console.log(chalk.cyan(`🔄 Current: ${current.description}`));
    }
    
    return this;
  }

  /**
   * Get formatted time string
   */
  getFormattedTime(milliseconds) {
    const seconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  }

  /**
   * Get progress percentage
   */
  getProgressPercentage() {
    const completed = this.steps.filter(s => s.status === 'completed').length;
    return this.steps.length > 0 ? Math.round((completed / this.steps.length) * 100) : 0;
  }

  /**
   * Get step completion time
   */
  getStepDuration(stepName) {
    const step = this.steps.find(s => s.name === stepName);
    return step ? step.duration : null;
  }

  /**
   * Get total process time
   */
  getTotalDuration() {
    return Date.now() - this.startTime;
  }

  /**
   * Complete the entire process
   */
  finish(success = true, finalMessage = null) {
    if (success) {
      const totalTime = this.getFormattedTime(this.getTotalDuration());
      const message = finalMessage || `Process completed successfully in ${totalTime}!`;
      this.spinner?.succeed(message);
    } else {
      this.spinner?.fail(finalMessage || 'Process failed');
    }
    
    // Stop spinner
    this.spinner?.stop();
    this.spinner = null;
    
    return this;
  }

  /**
   * Cancel the process
   */
  cancel(message = 'Process cancelled') {
    this.spinner?.warn(message);
    this.spinner?.stop();
    this.spinner = null;
    return this;
  }

  /**
   * Get process summary
   */
  getSummary() {
    const completed = this.steps.filter(s => s.status === 'completed').length;
    const failed = this.steps.filter(s => s.status === 'failed').length;
    const pending = this.steps.filter(s => s.status === 'pending').length;
    
    return {
      totalSteps: this.steps.length,
      completed,
      failed,
      pending,
      progress: this.getProgressPercentage(),
      totalTime: this.getTotalDuration(),
      formattedTotalTime: this.getFormattedTime(this.getTotalDuration()),
      steps: this.steps.map(step => ({
        name: step.name,
        description: step.description,
        status: step.status,
        duration: step.duration,
        formattedDuration: step.duration ? this.getFormattedTime(step.duration) : null
      }))
    };
  }

  /**
   * Reset the progress tracker
   */
  reset() {
    this.steps = [];
    this.currentStep = 0;
    this.spinner?.stop();
    this.spinner = null;
    this.startTime = Date.now();
    return this;
  }
}

module.exports = ProgressTracker;