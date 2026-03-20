const { Schema, model } = require('mongoose');

const projectSchema = new Schema({
  name: { type: String, required: true },
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
}, {
  timestamps: true,
});

projectSchema.index({ userId: 1, name: 1 }, { unique: true });

const Project = model('Project', projectSchema);

module.exports = Project;
