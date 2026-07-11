from django.db import models

PAYMENT_STATUS_CHOICES = [
    ('paid', 'Paid'),
    ('pending', 'Pending'),
    ('late', 'Late'),
]

SUBSCRIPTION_STATUS_CHOICES = [
    ('active', 'Active'),
    ('past_due', 'Past Due'),
    ('suspended', 'Suspended'),
    ('cancelled', 'Cancelled'),
]

PAYMENT_METHOD_TYPE_CHOICES = [
    ('cash', 'Cash'),
    ('transfer', 'Transfer'),
    ('card', 'Card'),
]

RECURRENCE_TYPE_CHOICES = [
    ('daily', 'Daily'),
    ('weekly', 'Weekly'),
    ('biweekly', 'Biweekly'),
    ('monthly', 'Monthly'),
    ('quarterly', 'Quarterly'),
    ('annual', 'Annual'),
]


class MembershipPlan(models.Model):
    trainer = models.ForeignKey(
        'users.TrainerProfile',
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='membership_plans'
    )
    name = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    price = models.DecimalField(max_digits=10, decimal_places=2)
    recurrence_type = models.CharField(
        max_length=20,
        choices=RECURRENCE_TYPE_CHOICES,
        default='monthly',
    )
    grace_period_days = models.PositiveIntegerField(default=7)
    features = models.TextField(blank=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ['name', 'id']
        indexes = [
            models.Index(fields=['trainer', 'is_active']),
        ]

    def __str__(self):
        return f"{self.name} ({self.price} / {self.get_recurrence_type_display()})"


class MemberSubscription(models.Model):
    member = models.ForeignKey(
        'users.MemberProfile',
        on_delete=models.CASCADE,
        related_name='subscriptions'
    )
    plan = models.ForeignKey(
        MembershipPlan,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='subscriptions'
    )
    membership_name = models.CharField(max_length=200, default='Membresía')
    description = models.TextField(blank=True)
    trainer = models.ForeignKey(
        'users.TrainerProfile',
        on_delete=models.CASCADE,
        related_name='member_subscriptions'
    )
    agreed_price = models.DecimalField(max_digits=10, decimal_places=2)
    start_date = models.DateField()
    next_billing_date = models.DateField()
    recurrence_type = models.CharField(
        max_length=20,
        choices=RECURRENCE_TYPE_CHOICES,
        default='monthly'
    )
    grace_period_days = models.PositiveIntegerField(default=7)
    auto_generate_next = models.BooleanField(default=True)
    is_active = models.BooleanField(default=True)
    status = models.CharField(
        max_length=20,
        choices=SUBSCRIPTION_STATUS_CHOICES,
        default='active',
    )
    renewal_date = models.DateField(null=True, blank=True)
    current_period_start = models.DateField(null=True, blank=True)
    current_period_end = models.DateField(null=True, blank=True)
    cancellation_date = models.DateField(null=True, blank=True)
    cancellation_reason = models.CharField(max_length=255, blank=True)
    commercial_notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-is_active', '-start_date', '-id']
        indexes = [
            models.Index(fields=['member', 'is_active']),
            models.Index(fields=['trainer', 'is_active']),
            models.Index(fields=['plan', 'is_active']),
            models.Index(fields=['status', 'is_active']),
        ]

    def __str__(self):
        return f"{self.member} — {self.membership_name} (${self.agreed_price})"


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
    subscription = models.ForeignKey(
        MemberSubscription,
        null=True,
        blank=True,
        on_delete=models.CASCADE,
        related_name='payment_schedules'
    )
    plan = models.ForeignKey(
        MembershipPlan,
        null=True,
        blank=True,
        on_delete=models.CASCADE,
        related_name='schedules'
    )
    due_date = models.DateField()
    period_start = models.DateField(null=True, blank=True)
    period_end = models.DateField(null=True, blank=True)
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
        constraints = [
            models.UniqueConstraint(
                fields=['subscription', 'period_start'],
                name='billing_unique_subscription_period',
            ),
        ]
        indexes = [
            models.Index(fields=['member', 'is_active', 'due_date']),
            models.Index(fields=['plan', 'is_active']),
        ]

    def __str__(self):
        return f"{self.member} — {self.resolved_plan} due {self.due_date}"

    @property
    def resolved_plan(self):
        if self.subscription_id:
            return self.subscription.plan
        return self.plan

    @property
    def resolved_membership_name(self):
        if self.subscription_id:
            return self.subscription.membership_name
        if self.plan_id:
            return self.plan.name
        return None


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
    payment_reference = models.CharField(max_length=120, blank=True)
    receipt_issued_at = models.DateTimeField(null=True, blank=True)
    notes = models.TextField(blank=True)

    class Meta:
        ordering = ['-schedule__due_date']
        indexes = [
            models.Index(fields=['status', 'paid_at']),
            models.Index(fields=['schedule', 'status']),
        ]

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
