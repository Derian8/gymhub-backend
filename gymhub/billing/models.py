from django.db import models

PAYMENT_STATUS_CHOICES = [
    ('paid', 'Paid'),
    ('pending', 'Pending'),
    ('late', 'Late'),
]

PAYMENT_METHOD_TYPE_CHOICES = [
    ('cash', 'Cash'),
    ('transfer', 'Transfer'),
    ('card', 'Card'),
]

RECURRENCE_TYPE_CHOICES = [
    ('monthly', 'Monthly'),
    ('quarterly', 'Quarterly'),
    ('annual', 'Annual'),
]


class MembershipPlan(models.Model):
    name = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    price_monthly = models.DecimalField(max_digits=10, decimal_places=2)
    duration_months = models.PositiveIntegerField(default=1)
    features = models.TextField(blank=True)

    def __str__(self):
        return f"{self.name} (${self.price_monthly}/mes)"


class PaymentMethod(models.Model):
    member = models.ForeignKey(
        'users.MemberProfile',
        on_delete=models.CASCADE,
        related_name='payment_methods'
    )
    type = models.CharField(max_length=20, choices=PAYMENT_METHOD_TYPE_CHOICES)
    details = models.CharField(max_length=500, blank=True)
    is_default = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)

    def __str__(self):
        return f"{self.member} — {self.type}"


class PaymentSchedule(models.Model):
    member = models.ForeignKey(
        'users.MemberProfile',
        on_delete=models.CASCADE,
        related_name='payment_schedules'
    )
    plan = models.ForeignKey(
        MembershipPlan,
        on_delete=models.CASCADE,
        related_name='schedules'
    )
    due_date = models.DateField()
    recurrence_type = models.CharField(
        max_length=20,
        choices=RECURRENCE_TYPE_CHOICES,
        default='monthly'
    )
    grace_period_days = models.PositiveIntegerField(default=7)
    auto_generate_next = models.BooleanField(default=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ['-due_date']

    def __str__(self):
        return f"{self.member} — {self.plan} due {self.due_date}"


class PaymentRecord(models.Model):
    schedule = models.ForeignKey(
        PaymentSchedule,
        on_delete=models.CASCADE,
        related_name='records'
    )
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    paid_at = models.DateTimeField(null=True, blank=True)
    status = models.CharField(
        max_length=20,
        choices=PAYMENT_STATUS_CHOICES,
        default='pending'
    )
    method_used = models.ForeignKey(
        PaymentMethod,
        null=True, blank=True,
        on_delete=models.SET_NULL,
        related_name='payment_records'
    )
    notes = models.TextField(blank=True)

    class Meta:
        ordering = ['-schedule__due_date']

    def __str__(self):
        return f"{self.schedule.member} — {self.status} ${self.amount}"


class PaymentInstruction(models.Model):
    plan = models.ForeignKey(
        MembershipPlan,
        on_delete=models.CASCADE,
        related_name='instructions'
    )
    title = models.CharField(max_length=200)
    steps_text = models.TextField()
    bank_info = models.TextField(blank=True)
    qr_image = models.ImageField(upload_to='payment_qr/', null=True, blank=True)

    def __str__(self):
        return f"Instrucción: {self.title}"
