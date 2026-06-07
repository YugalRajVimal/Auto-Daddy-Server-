import mongoose from 'mongoose';

const dashboardDataSchema = new mongoose.Schema({
  thoughtOfTheDay: {
    type: String,
    default: 'Push yourself, because no one else is going to do it for you.'
  },
  thoughtOfTheDayLike: {
    type: Number,
    default: 0
  },
  sections: [
    {
      heading: { type: String, required: true },
      desc: { type: String, required: true }
    }
  ],
  createdAt: {
    type: Date,
    default: Date.now
  }
});

const DashboardDataModel = mongoose.model('DashboardData', dashboardDataSchema);
export default DashboardDataModel;